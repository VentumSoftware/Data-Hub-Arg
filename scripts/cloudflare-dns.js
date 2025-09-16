#!/usr/bin/env node

/**
 * Cloudflare DNS management for dev environments
 * Creates/updates DNS records for project deployments
 */

const https = require('https');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`)
};

class CloudflareAPI {
  constructor(apiToken, zoneId) {
    this.apiToken = apiToken;
    this.zoneId = zoneId;
    this.baseUrl = 'api.cloudflare.com';
  }

  async request(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl,
        port: 443,
        path: `/client/v4${path}`,
        method: method,
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(body);
            if (response.success) {
              resolve(response.result);
            } else {
              reject(new Error(response.errors?.[0]?.message || 'Unknown error'));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);

      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  async findRecord(name, type = 'A') {
    try {
      const records = await this.request('GET', `/zones/${this.zoneId}/dns_records?name=${name}&type=${type}`);
      return records.length > 0 ? records[0] : null;
    } catch (error) {
      return null;
    }
  }

  async createRecord(name, type, content, proxied = true) {
    const data = {
      type,
      name,
      content,
      proxied,
      ttl: proxied ? 1 : 300
    };

    return await this.request('POST', `/zones/${this.zoneId}/dns_records`, data);
  }

  async updateRecord(recordId, content, proxied = true) {
    const data = {
      content,
      proxied,
      ttl: proxied ? 1 : 300
    };

    return await this.request('PATCH', `/zones/${this.zoneId}/dns_records/${recordId}`, data);
  }

  async deleteRecord(recordId) {
    return await this.request('DELETE', `/zones/${this.zoneId}/dns_records/${recordId}`);
  }
}

async function manageDNSRecord(action, projectName, ipAddress) {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;

  if (!apiToken || !zoneId) {
    log.error('Missing Cloudflare credentials. Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID');
    process.exit(1);
  }

  const cf = new CloudflareAPI(apiToken, zoneId);
  const domain = `${projectName}.dev.ventum.dev`;

  try {
    switch (action) {
      case 'create':
      case 'update':
        if (!ipAddress) {
          log.error('IP address is required for create/update operations');
          process.exit(1);
        }

        log.info(`${action === 'create' ? 'Creating' : 'Updating'} DNS record for ${domain} -> ${ipAddress}`);
        
        const existingRecord = await cf.findRecord(domain);
        
        if (existingRecord) {
          await cf.updateRecord(existingRecord.id, ipAddress, true);
          log.success(`Updated DNS record: ${domain} -> ${ipAddress}`);
        } else {
          await cf.createRecord(domain, 'A', ipAddress, true);
          log.success(`Created DNS record: ${domain} -> ${ipAddress}`);
        }
        break;

      case 'delete':
        log.info(`Deleting DNS record for ${domain}`);
        
        const recordToDelete = await cf.findRecord(domain);
        
        if (recordToDelete) {
          await cf.deleteRecord(recordToDelete.id);
          log.success(`Deleted DNS record: ${domain}`);
        } else {
          log.warning(`DNS record not found: ${domain}`);
        }
        break;

      case 'check':
        log.info(`Checking DNS record for ${domain}`);
        
        const record = await cf.findRecord(domain);
        
        if (record) {
          log.success(`DNS record exists: ${domain} -> ${record.content} (Proxied: ${record.proxied})`);
          console.log(JSON.stringify(record, null, 2));
        } else {
          log.warning(`DNS record not found: ${domain}`);
        }
        break;

      default:
        log.error('Invalid action. Use: create, update, delete, or check');
        process.exit(1);
    }
  } catch (error) {
    log.error(`DNS operation failed: ${error.message}`);
    process.exit(1);
  }
}

// CLI Usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const [action, projectName, ipAddress] = args;

  if (!action || !projectName) {
    console.log(`
Usage: node cloudflare-dns.js <action> <project-name> [ip-address]

Actions:
  create    Create new DNS record (requires IP)
  update    Update existing DNS record (requires IP)  
  delete    Delete DNS record
  check     Check if DNS record exists

Examples:
  node cloudflare-dns.js create my-app 134.122.123.45
  node cloudflare-dns.js update my-app 134.122.123.46
  node cloudflare-dns.js delete my-app
  node cloudflare-dns.js check my-app

Environment variables:
  CLOUDFLARE_API_TOKEN - Your Cloudflare API token
  CLOUDFLARE_ZONE_ID   - Zone ID for ventum.dev domain
    `);
    process.exit(1);
  }

  manageDNSRecord(action, projectName, ipAddress);
}

module.exports = { CloudflareAPI, manageDNSRecord };