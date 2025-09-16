#!/usr/bin/env node

const https = require('http');
const { URLSearchParams } = require('url');

// Configuration from environment variables
const config = {
  adminName: process.env.PLAUSIBLE_ADMIN_NAME || 'Admin User',
  adminEmail: process.env.PLAUSIBLE_ADMIN_EMAIL || 'admin@localhost',
  adminPassword: process.env.PLAUSIBLE_ADMIN_PASSWORD || 'admin123',
  siteDomain: process.env.PLAUSIBLE_SITE_DOMAIN || 'localhost',
  baseUrl: process.env.PLAUSIBLE_BASE_URL || 'http://localhost:8000',
  port: process.env.PLAUSIBLE_PORT || '8000'
};

// Helper function to make HTTP requests
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', reject);
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

// Wait for Plausible to be ready
async function waitForPlausible() {
  console.log('🔄 Waiting for Plausible to be ready...');
  const timeout = 60;
  
  for (let count = 0; count < timeout; count++) {
    try {
      const options = {
        hostname: 'localhost',
        port: config.port,
        path: '/api/health',
        method: 'GET',
        timeout: 1000
      };
      
      await makeRequest(options);
      console.log('✅ Plausible is ready!');
      return true;
    } catch (error) {
      console.log(`⏳ Waiting for Plausible... (${count}/${timeout}s)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('❌ Timeout waiting for Plausible to start');
  process.exit(1);
}

// Register admin user
async function registerAdmin() {
  console.log('🔧 Creating admin user...');
  
  const postData = new URLSearchParams({
    'user[name]': config.adminName,
    'user[email]': config.adminEmail,
    'user[password]': config.adminPassword,
    'user[password_confirmation]': config.adminPassword
  }).toString();

  const options = {
    hostname: 'localhost',
    port: config.port,
    path: '/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  try {
    const response = await makeRequest(options, postData);
    if (response.statusCode === 200 || response.statusCode === 302) {
      console.log('✅ Admin user created successfully');
      return true;
    } else {
      console.log(`⚠️  User might already exist (HTTP: ${response.statusCode})`);
      return true; // Continue anyway
    }
  } catch (error) {
    console.log(`⚠️  Registration error: ${error.message}`);
    return true; // Continue anyway
  }
}

// Login to get session cookie
async function loginAdmin() {
  console.log('🔑 Logging in...');
  
  const postData = new URLSearchParams({
    email: config.adminEmail,
    password: config.adminPassword
  }).toString();

  const options = {
    hostname: 'localhost',
    port: config.port,
    path: '/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  try {
    const response = await makeRequest(options, postData);
    if (response.statusCode === 200 || response.statusCode === 302) {
      console.log('✅ Login successful');
      // Extract cookies from response headers
      const cookies = response.headers['set-cookie'] || [];
      return cookies.map(cookie => cookie.split(';')[0]).join('; ');
    } else {
      console.log(`❌ Login failed (HTTP: ${response.statusCode})`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Login error: ${error.message}`);
    return null;
  }
}

// Create site
async function createSite(sessionCookie) {
  console.log(`🌐 Creating site: ${config.siteDomain}`);
  
  const postData = new URLSearchParams({
    'site[domain]': config.siteDomain,
    'site[timezone]': 'UTC'
  }).toString();

  const options = {
    hostname: 'localhost',
    port: config.port,
    path: '/sites',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
      'Cookie': sessionCookie
    }
  };

  try {
    const response = await makeRequest(options, postData);
    if (response.statusCode === 200 || response.statusCode === 302) {
      console.log('✅ Site created successfully');
      return true;
    } else {
      console.log(`⚠️  Site might already exist (HTTP: ${response.statusCode})`);
      return true;
    }
  } catch (error) {
    console.log(`⚠️  Site creation error: ${error.message}`);
    return false;
  }
}

// Main setup function
async function setupPlausible() {
  console.log('📝 Setting up Plausible with the following configuration:');
  console.log(`   Admin Name: ${config.adminName}`);
  console.log(`   Admin Email: ${config.adminEmail}`);
  console.log(`   Site Domain: ${config.siteDomain}`);
  console.log(`   Base URL: ${config.baseUrl}`);
  console.log('');

  try {
    await waitForPlausible();
    await registerAdmin();
    const sessionCookie = await loginAdmin();
    
    if (sessionCookie) {
      await createSite(sessionCookie);
    }

    console.log('');
    console.log('🎉 Plausible Analytics setup complete!');
    console.log('');
    console.log('📊 Access your analytics dashboard:');
    console.log(`   URL: ${config.baseUrl}`);
    console.log(`   Email: ${config.adminEmail}`);
    console.log(`   Password: ${config.adminPassword}`);
    console.log('');
    console.log('🔗 Your tracking script is already configured in your frontend');
    console.log('   Visit http://localhost:5173 to start collecting analytics!');
    console.log('');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup
setupPlausible();