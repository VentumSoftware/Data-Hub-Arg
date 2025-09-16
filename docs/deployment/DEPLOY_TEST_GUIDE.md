# 🚀 Deploy Your First Project - Step by Step Guide

Follow these steps to create and deploy your first project using the Ventum Framework.

## Prerequisites Checklist

Before starting, make sure you have:
- [ ] GitHub account
- [ ] DigitalOcean account ($200 free credit for new users)
- [ ] Cloudflare account (free plan is fine)
- [ ] Domain added to Cloudflare (ventum.dev or your own)

## Step 1: Create Your New Project

```bash
# Go to a directory where you want to create the project
cd ~/Documents/Projects  # or wherever you keep your projects

# Clone the template
git clone https://github.com/jbnogal-ventum/ventum-framework.git ventum-test
cd ventum-test

# Run the setup script
npm install  # Install dependencies first
npm run setup-project

# When prompted:
# - Project name: ventum-test
# - GitHub username: your-github-username (or press Enter to skip)
```

## Step 2: Create GitHub Repository

1. Go to https://github.com/new
2. Create a new repository named `ventum-test`
3. **DON'T** initialize with README, .gitignore, or license
4. After creating, you'll see instructions. Run these commands:

```bash
# In your ventum-test directory
git remote add origin https://github.com/YOUR_USERNAME/ventum-test.git
git branch -M main
git push -u origin main
```

## Step 3: Set Up DigitalOcean

### 3.1 Get API Token
1. Go to https://cloud.digitalocean.com/account/api/tokens
2. Click "Generate New Token"
3. Name: "Ventum Deployments"
4. Scopes: Select "Full Access" (both read and write)
5. Copy the token (you won't see it again!)

### 3.2 Create SSH Key (if you don't have one)
```bash
# Generate SSH key
ssh-keygen -t rsa -b 4096 -f ~/.ssh/do_deploy_key -N ""

# Display the public key
cat ~/.ssh/do_deploy_key.pub
```

### 3.3 Add SSH Key to DigitalOcean
1. Go to https://cloud.digitalocean.com/account/security
2. Click "Add SSH Key"
3. Paste your public key
4. Name it "Ventum Deploy Key"
5. Copy the fingerprint shown after adding

## Step 4: Set Up Cloudflare

### 4.1 Add Your Domain to Cloudflare
1. Go to https://dash.cloudflare.com
2. Add site: `ventum.dev` (or your domain)
3. Follow instructions to update nameservers at your registrar
4. Wait for domain to be active (can take up to 24 hours, usually faster)

### 4.2 Get API Token
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use template: "Edit zone DNS"
4. Permissions:
   - Zone → DNS → Edit
   - Zone → Zone → Read
5. Zone Resources: Include → Specific zone → ventum.dev
6. Copy the token

### 4.3 Get Zone ID
1. Go to your domain overview in Cloudflare
2. On the right sidebar, find "Zone ID"
3. Copy it

## Step 5: Configure GitHub Secrets

Go to your repository: https://github.com/YOUR_USERNAME/ventum-test/settings/secrets/actions

Add these secrets (click "New repository secret" for each):

### DigitalOcean Secrets
```
DIGITALOCEAN_ACCESS_TOKEN = dop_v1_xxxxx...  (from Step 3.1)
DO_SSH_KEY_FINGERPRINT = aa:bb:cc:dd:...     (from Step 3.3)
DO_SSH_PRIVATE_KEY = (paste entire private key including BEGIN/END lines)
```

To get the private key:
```bash
cat ~/.ssh/do_deploy_key
```

### Cloudflare Secrets
```
CLOUDFLARE_API_TOKEN = xxx...  (from Step 4.2)
CLOUDFLARE_ZONE_ID = xxx...    (from Step 4.3)
```

### Application Secrets
```
ADMIN_EMAIL = your@email.com
DEV_JWT_SECRET = any-random-string-make-it-long-and-secure
DEV_POSTGRES_DB = ventum_test_dev
DEV_POSTGRES_USER = ventum_user
DEV_POSTGRES_PASSWORD = choose-a-secure-password
```

Optional (for Google OAuth):
```
GOOGLE_CLIENT_ID = xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET = xxx
```

## Step 6: Deploy! 🚀

```bash
# Create and push to dev branch
git checkout -b dev
git add .
git commit -m "Initial setup for ventum-test"
git push origin dev
```

## Step 7: Watch the Magic Happen ✨

1. Go to: https://github.com/YOUR_USERNAME/ventum-test/actions
2. You'll see "Deploy Dev - Auto Droplet" workflow running
3. Click on it to watch the progress (takes about 8-12 minutes)

## Step 8: Access Your App! 🎉

Once deployment is complete, you can access:
- **With SSL**: https://ventum-test.dev.ventum.dev
- **API**: https://ventum-test.dev.ventum.dev/api
- **Health**: https://ventum-test.dev.ventum.dev/health

## Troubleshooting

### Workflow Fails at "Install doctl"
- Check your DIGITALOCEAN_ACCESS_TOKEN is correct

### Workflow Fails at "Manage Droplet"
- Check your SSH key fingerprint is correct
- Make sure the SSH key exists in DigitalOcean

### DNS Not Resolving
- Check Cloudflare token and zone ID
- Wait a few minutes for DNS propagation
- Try: `dig ventum-test.dev.ventum.dev`

### SSL Certificate Fails
- Make sure DNS is resolving first
- Check ADMIN_EMAIL is valid
- SSH into droplet and check: `sudo certbot certificates`

### Application Not Starting
SSH into your droplet:
```bash
# Get droplet IP from DigitalOcean dashboard or GitHub Actions output
ssh root@YOUR_DROPLET_IP

# Check Docker containers
cd /app
docker-compose ps
docker-compose logs -f
```

## Clean Up (When Done Testing)

To destroy the test environment and save money:

1. Go to GitHub Actions
2. Run "Cleanup Dev Environment" workflow manually
3. Enter project name: `ventum-test`

Or manually:
```bash
# Delete droplet
doctl compute droplet delete ventum-test-dev --force

# Remove DNS record
CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ZONE_ID=xxx \
  node scripts/cloudflare-dns.js delete ventum-test
```

## Next Steps

Once your test deployment works:
1. Create a real project with a meaningful name
2. Customize the code in `packages/backend/src/modules/custom/`
3. Add your business logic
4. Set up staging and production environments

## Costs

- **Development Droplet**: $24/month (s-2vcpu-4gb)
- **Can be destroyed when not in use**
- **First deployment might take longer due to droplet creation**

## Support

- Check GitHub Actions logs for detailed error messages
- SSH into droplet for debugging
- Check the guides:
  - [DEV_DEPLOYMENT_SETUP.md](./DEV_DEPLOYMENT_SETUP.md)
  - [CI_CD_GUIDE.md](./CI_CD_GUIDE.md)