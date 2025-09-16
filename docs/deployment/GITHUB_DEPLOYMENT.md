# GitHub Actions Auto-Deployment Guide

This guide walks you through setting up automatic deployment to Digital Ocean using GitHub Actions.

## Overview

Push to `dev` branch → GitHub builds and deploys automatically → Your app is live! 🚀

## Prerequisites

- GitHub account
- Digital Ocean account
- Basic terminal knowledge

## Step 1: Create Digital Ocean Droplet

### In Digital Ocean Dashboard:
1. Click **"Create Droplet"**
2. Configure:
   - **Image**: Ubuntu 22.04 LTS
   - **Size**: Basic → Regular → $12/mo (2GB RAM minimum)
   - **Region**: Choose closest to your users
   - **Authentication**: SSH Key (recommended) or Password
3. Click **"Create Droplet"**
4. **Save the IP address** (e.g., `167.99.123.45`)

## Step 2: Set Up the Droplet

### SSH into your droplet:
```bash
ssh root@YOUR_DROPLET_IP
```

### Install required software:
```bash
# Update system
apt-get update && apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install Node.js and Git
apt-get install -y nodejs npm git

# Create app directory
mkdir -p ~/app
cd ~/app

# Test installations
docker --version
docker-compose --version
node --version

# Exit SSH
exit
```

## Step 3: Create GitHub Repository

### If you haven't already:
1. Go to [GitHub.com](https://github.com)
2. Click **"New Repository"**
3. Name it (e.g., `my-ventum-app`)
4. **Don't** initialize with README
5. Push your code:

```bash
# In your local Ventum project
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main

# Create dev branch for auto-deployment
git checkout -b dev
git push -u origin dev
```

## Step 4: Get Your SSH Private Key

### Find or create SSH key:
```bash
# Check if you have an SSH key
ls ~/.ssh/

# If id_rsa exists, copy it:
cat ~/.ssh/id_rsa

# If not, create one:
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
# Press Enter for all prompts (default location and no passphrase)

# Copy your PRIVATE key
cat ~/.ssh/id_rsa
```

**Copy the entire output** including:
```
-----BEGIN RSA PRIVATE KEY-----
[many lines of characters]
-----END RSA PRIVATE KEY-----
```

⚠️ **Keep this private key secure!**

## Step 5: Configure GitHub Secrets

### In your GitHub repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"**
3. Add each secret:

### Required Secrets:

| Secret Name | Value | Example |
|------------|-------|---------|
| `APP_NAME` | Your app name | `myapp` |
| `DO_DEV_HOST` | Your droplet IP | `167.99.123.45` |
| `DO_DEV_USER` | SSH username | `root` |
| `DO_SSH_KEY` | Your private SSH key | *(entire key with headers)* |

### Database Secrets:

| Secret Name | Value | Example |
|------------|-------|---------|
| `DEV_POSTGRES_DB` | Database name | `myapp_dev` |
| `DEV_POSTGRES_USER` | Database user | `myapp_user` |
| `DEV_POSTGRES_PASSWORD` | Strong password | *(generate secure password)* |
| `DEV_JWT_SECRET` | JWT secret | *(generate random string)* |

### Generate Secure Values:
```bash
# Generate secure password (32 characters)
openssl rand -base64 32

# Generate JWT secret (64 characters)
openssl rand -base64 64
```

### Optional (Google OAuth):

| Secret Name | Value |
|------------|-------|
| `GOOGLE_AUTH_CLIENT_ID` | Your Google OAuth Client ID |
| `GOOGLE_AUTH_CLIENT_SECRET` | Your Google OAuth Secret |

## Step 6: Initial Droplet Setup

### Clone repository on droplet:
```bash
ssh root@YOUR_DROPLET_IP

# Clone your repo
cd ~/app
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git .
git checkout dev

# Verify files are there
ls -la

# Exit
exit
```

## Step 7: Test SSH Connection

### Verify GitHub Actions can connect:
```bash
# Test connection (should work without password)
ssh root@YOUR_DROPLET_IP "echo 'Connection successful!'"
```

If this fails, check:
- SSH key is correct in GitHub secrets
- You're using the right IP address
- Droplet allows SSH connections

## Step 8: Deploy!

### Trigger first deployment:
```bash
# Make a small change to trigger deployment
echo "# Auto-deployed! 🚀" >> README.md
git add .
git commit -m "First auto-deployment"
git push origin dev
```

### Watch the magic happen:
1. Go to your GitHub repository
2. Click **"Actions"** tab
3. You should see "Deploy to Development" running
4. Takes about 3-5 minutes

## Step 9: Verify Deployment

### Check if your app is live:

**In browser:**
- Frontend: `http://YOUR_DROPLET_IP:5173`
- Backend API: `http://YOUR_DROPLET_IP:3000/api/docs`
- Health check: `http://YOUR_DROPLET_IP:3000/api/health`

**In terminal:**
```bash
# Quick health check
curl http://YOUR_DROPLET_IP:3000/api/health
```

Should return something like:
```json
{"status":"ok","timestamp":"2024-..."}
```

## Troubleshooting

### ❌ Deployment Failed

**Check GitHub Actions logs:**
1. Go to **Actions** tab in GitHub
2. Click on the failed run
3. Expand the failed step to see error

**Common issues:**

| Error | Solution |
|-------|----------|
| `Permission denied (publickey)` | Check `DO_SSH_KEY` secret is your private key |
| `Host key verification failed` | SSH into droplet manually once to accept host key |
| `docker: command not found` | Re-run droplet setup commands |
| `Port already in use` | SSH in and run `docker-compose down` |

### 🔍 Debug on Droplet

```bash
# SSH into droplet
ssh root@YOUR_DROPLET_IP

# Check app directory
cd ~/app
ls -la

# Check Docker status
docker ps
docker-compose logs

# Check if services are running
docker-compose ps
```

### 🔄 Force Redeploy

```bash
# Make any change and push
git commit --allow-empty -m "Force redeploy"
git push origin dev
```

## How It Works

### What happens when you push to `dev`:

1. **GitHub Actions triggers** (see `.github/workflows/deploy-dev.yml`)
2. **Builds your app** with Node.js and npm
3. **Connects to your droplet** via SSH
4. **Pulls latest code** from dev branch
5. **Builds Docker containers** with your app
6. **Runs database migrations** and seeds
7. **Starts services** (backend, frontend, database)
8. **Health checks** to verify it's working

### File locations on droplet:
```
~/app/                    # Your application code
├── docker-compose.yml    # Container configuration
├── .env                  # Environment variables
├── packages/
│   ├── backend/         # API server
│   ├── frontend/        # React app
│   └── mobile/          # React Native app
```

## Daily Workflow

### Once set up, your workflow is simple:

```bash
# 1. Make changes locally
git add .
git commit -m "Add new feature"

# 2. Push to dev branch
git push origin dev

# 3. Wait 3-5 minutes
# 4. Your changes are live! 🎉
```

## Security Best Practices

### Secrets Management:
- ✅ Never commit `.env` files
- ✅ Use strong passwords (32+ characters)
- ✅ Rotate secrets regularly
- ✅ Use different secrets for different environments

### Server Security:
```bash
# Enable firewall
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw allow 3000  # Backend
ufw allow 5173  # Frontend
ufw enable

# Regular updates
apt-get update && apt-get upgrade -y
```

## Production Deployment

### For production, create additional workflows:
- `deploy-staging.yml` (triggers on `staging` branch)
- `deploy-prod.yml` (triggers on `main` branch)

### Use separate secrets:
- `STAGING_*` and `PROD_*` secrets
- Different droplets for each environment
- SSL certificates for production

## Cost Estimate

### Digital Ocean costs:
- **Basic Droplet (2GB)**: $12/month
- **Managed Database**: $15/month (optional)
- **Load Balancer**: $10/month (for production)
- **Total for dev environment**: ~$12/month

## Next Steps

1. **Set up monitoring** (logs, uptime)
2. **Configure SSL** for production
3. **Add staging environment**
4. **Set up backups**
5. **Configure domain name**

## Support

### Need help?
- **GitHub Actions docs**: https://docs.github.com/actions
- **Digital Ocean docs**: https://docs.digitalocean.com
- **Docker docs**: https://docs.docker.com

### Common commands:
```bash
# View deployment logs
gh run list  # GitHub CLI
gh run view [RUN_ID] --log

# Check droplet status
ssh root@YOUR_DROPLET_IP "docker-compose ps"

# Restart services
ssh root@YOUR_DROPLET_IP "cd ~/app && docker-compose restart"
```

**Happy deploying! 🚀**