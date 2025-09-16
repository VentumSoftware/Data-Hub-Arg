# Development Environment Setup Guide

## Quick Setup Checklist

To deploy your project to `<PROJECT_NAME>.dev.ventum.dev`, follow these steps:

### 0. Project Name Setup (Automatic)

When you created your project with `npm run setup-project`, the APP_NAME was automatically set in `.env.example`. The deployment workflow will read this value automatically, so you don't need to set it as a GitHub secret unless you want to override it.

### 1. Cloudflare Setup

First, set up your Cloudflare domain and get API credentials:

1. **Add Domain to Cloudflare**
   - Go to Cloudflare dashboard
   - Add `ventum.dev` domain
   - Update nameservers at your domain registrar

2. **Get API Credentials**
   ```bash
   # Go to: https://dash.cloudflare.com/profile/api-tokens
   # Create token with permissions:
   # - Zone:Zone Settings:Read
   # - Zone:Zone:Read  
   # - Zone:DNS:Edit
   
   # Get Zone ID from your domain overview page
   ```

### 2. DigitalOcean Setup

1. **Create API Token**
   - Go to: https://cloud.digitalocean.com/account/api/tokens
   - Generate new token with read/write access

2. **Create SSH Key**
   ```bash
   ssh-keygen -t rsa -b 4096 -f ~/.ssh/do_deploy_key
   
   # Add to DigitalOcean
   doctl compute ssh-key import deploy-key --public-key-file ~/.ssh/do_deploy_key.pub
   
   # Get fingerprint
   doctl compute ssh-key list
   ```

### 3. GitHub Secrets Configuration

Add these secrets to your GitHub repository (Settings → Secrets → Actions):

#### Required Secrets
```bash
# DigitalOcean
DIGITALOCEAN_ACCESS_TOKEN="dop_v1_xxxxx"
DO_REGION="nyc1"                      # or your preferred region
DO_SSH_KEY_FINGERPRINT="aa:bb:cc..." # from step 2
DO_SSH_PRIVATE_KEY="-----BEGIN OPENSSH PRIVATE KEY-----..."

# Cloudflare  
CLOUDFLARE_API_TOKEN="xxx_your_token_xxx"
CLOUDFLARE_ZONE_ID="your_zone_id"

# Application
APP_NAME="your-project-name"          # OPTIONAL - automatically read from .env.example
ADMIN_EMAIL="your@email.com"          # for Let's Encrypt

# Database & Auth
DEV_POSTGRES_DB="app_dev"
DEV_POSTGRES_USER="app_user" 
DEV_POSTGRES_PASSWORD="secure_dev_password"
DEV_JWT_SECRET="your_jwt_secret_key"

# Google OAuth (optional)
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
```

## Testing the Deployment

### Method 1: Push to Dev Branch

```bash
# Create and push to dev branch
git checkout -b dev
git push origin dev

# This will trigger the deployment automatically
```

### Method 2: Manual Trigger

1. Go to GitHub Actions tab
2. Select "Deploy Dev - Auto Droplet" workflow  
3. Click "Run workflow"
4. Select branch: `dev`

### Method 3: Test DNS Script Locally

```bash
# Set environment variables
export CLOUDFLARE_API_TOKEN="your_token"
export CLOUDFLARE_ZONE_ID="your_zone_id"

# Test DNS operations
node scripts/cloudflare-dns.js check my-app
node scripts/cloudflare-dns.js create my-app 134.122.123.45
node scripts/cloudflare-dns.js update my-app 134.122.123.46
node scripts/cloudflare-dns.js delete my-app
```

## What Happens During Deployment

### Phase 1: Infrastructure (2-3 minutes)
```
✅ Check if droplet exists
✅ Create droplet if needed (with Docker, Nginx, Certbot pre-installed)
✅ Wait for SSH availability
```

### Phase 2: Application (3-5 minutes)
```  
✅ Clone/update repository
✅ Create .env file with secrets
✅ Build and start Docker containers
✅ Run database migrations
✅ Health check backend
```

### Phase 3: Domain & SSL (2-3 minutes)
```
✅ Update Cloudflare DNS record
✅ Configure Nginx with SSL
✅ Get Let's Encrypt certificate
✅ Enable auto-renewal
```

### Total Time: ~8-12 minutes

## Expected Results

After successful deployment, you should see:

```
🚀 Development Deployment Successful!

🌐 Custom Domain (with SSL):
• Application: https://your-project.dev.ventum.dev
• API: https://your-project.dev.ventum.dev/api  
• Health Check: https://your-project.dev.ventum.dev/health

📡 Direct IP Access:
• Droplet IP: 134.122.123.45
• Frontend: http://134.122.123.45:5173
• Backend: http://134.122.123.45:3000

⚡ Features:
✅ Custom subdomain: your-project.dev.ventum.dev
✅ SSL certificate via Let's Encrypt
✅ Cloudflare CDN & DDoS protection  
✅ Auto-renewal enabled
```

## Troubleshooting

### DNS Not Resolving
```bash
# Check DNS propagation
dig your-project.dev.ventum.dev

# Check Cloudflare record
node scripts/cloudflare-dns.js check your-project

# Force DNS update
node scripts/cloudflare-dns.js update your-project <droplet-ip>
```

### SSL Certificate Issues
```bash
# SSH into droplet
ssh root@<droplet-ip>

# Check Certbot logs
journalctl -u certbot -f

# Manual certificate request
certbot --nginx -d your-project.dev.ventum.dev

# Check certificate status
certbot certificates
```

### Application Not Starting
```bash
# SSH into droplet
ssh root@<droplet-ip>

# Check containers
cd /app
docker-compose ps
docker-compose logs -f

# Check .env file
cat .env

# Restart containers
docker-compose down
docker-compose up -d --build
```

### Database Issues
```bash
# Connect to database
docker exec -it <app-name>-postgres psql -U app_user -d app_dev

# Run migrations manually
docker exec -it <app-name>-backend npm run migration:run

# Check database logs
docker logs <app-name>-postgres -f
```

## Cleanup

To destroy the development environment:

```bash
# Method 1: Use cleanup workflow
# Go to GitHub Actions → "Cleanup Dev Environment" → Run manually

# Method 2: Manual cleanup
doctl compute droplet delete your-project-dev --force
node scripts/cloudflare-dns.js delete your-project
```

## Cost Estimation

**Monthly cost for development droplet:**
- **s-1vcpu-2gb**: $12/month (minimum for Docker)
- **s-2vcpu-4gb**: $24/month (recommended) 
- **s-4vcpu-8gb**: $48/month (for heavy workloads)

**Additional costs:**
- Cloudflare: Free plan sufficient
- DigitalOcean snapshots: $0.05/GB/month
- Bandwidth: 1TB included

**Cost optimization:**
- Destroy droplets when not in use
- Use snapshots to save state
- Scale down to smaller droplets for testing

## Advanced Configuration

### Custom Domain Structure
- `<project>.dev.ventum.dev` - Main app
- `api-<project>.dev.ventum.dev` - API only (optional)
- `docs-<project>.dev.ventum.dev` - Documentation (optional)

### Multiple Environments
```bash
# Different environments on subdomains
your-project.dev.ventum.dev      # development
your-project.staging.ventum.dev  # staging  
your-project.ventum.dev          # production
```

### Custom SSL Certificates
If you prefer custom SSL certificates over Let's Encrypt:

```bash
# Add secrets to GitHub:
SSL_CERTIFICATE="-----BEGIN CERTIFICATE-----..."
SSL_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."

# Update deployment script to use custom certs
```

## Next Steps

1. **Test your first deployment** using the steps above
2. **Set up monitoring** (optional but recommended)
3. **Configure notifications** for deployment status
4. **Set up staging environment** using App Platform
5. **Plan production deployment** using Kubernetes

## Support

- **Template Issues**: GitHub Issues on ventum-framework repo
- **Deployment Issues**: Check GitHub Actions logs
- **DNS Issues**: Cloudflare dashboard → DNS → Records
- **Server Issues**: SSH into droplet and check Docker logs