# Digital Ocean Deployment Setup

This guide shows how to set up automatic deployment to Digital Ocean for your forked project.

## Architecture

### 3-Tier Deployment Strategy

1. **Dev Environment** 
   - Single droplet with docker-compose
   - Local PostgreSQL in container
   - Direct port access (3000, 5173)
   - Push to `dev` branch → auto deploy

2. **Staging Environment**
   - Single droplet with docker-compose
   - Managed PostgreSQL database
   - Nginx with SSL
   - Push to `staging` branch → auto deploy

3. **Production Environment**
   - Droplet with docker-compose
   - Managed PostgreSQL + Redis
   - Nginx with Let's Encrypt SSL
   - CDN and object storage
   - Push to `main` branch → auto deploy

## Digital Ocean Resources Needed

### 1. Droplets (VPS)
```bash
# Create droplets
doctl compute droplet create your-app-dev \
  --image docker-20-04 \
  --size s-1vcpu-1gb \
  --region nyc1

doctl compute droplet create your-app-staging \
  --image docker-20-04 \
  --size s-1vcpu-2gb \
  --region nyc1

doctl compute droplet create your-app-prod \
  --image docker-20-04 \
  --size s-2vcpu-4gb \
  --region nyc1
```

### 2. Managed Databases
```bash
# Staging database
doctl databases create your-app-staging \
  --engine postgres \
  --version 15 \
  --size db-s-1vcpu-1gb \
  --region nyc1

# Production database
doctl databases create your-app-prod \
  --engine postgres \
  --version 15 \
  --size db-s-1vcpu-2gb \
  --region nyc1
```

### 3. Spaces (Object Storage) - Optional
```bash
# For production file uploads
doctl spaces create your-app-uploads --region nyc3
```

## GitHub Repository Setup

### 1. Fork the Template
```bash
# Fork this repository
git clone https://github.com/your-username/your-app-name.git
cd your-app-name

# Create branches
git checkout -b dev
git push origin dev

git checkout -b staging  
git push origin staging

# main branch is production
```

### 2. Repository Secrets

Add these secrets in GitHub → Settings → Secrets and Variables → Actions:

#### SSH Access
```
DO_SSH_KEY                    # Your private SSH key
DO_DEV_USER                   # ubuntu
DO_DEV_HOST                   # dev droplet IP
DO_STAGING_USER               # ubuntu  
DO_STAGING_HOST               # staging droplet IP
DO_PRODUCTION_USER            # ubuntu
DO_PRODUCTION_HOST            # production droplet IP
```

#### Database Credentials
```
# Dev (local)
DEV_DB_PASSWORD               # Strong password for local dev DB

# Staging (managed)
STAGING_DATABASE_URL          # postgres://user:pass@host:port/db

# Production (managed) 
PRODUCTION_DATABASE_URL       # postgres://user:pass@host:port/db
```

#### Authentication
```
JWT_SECRET                    # Production JWT secret
JWT_SECRET_STAGING            # Staging JWT secret  
JWT_SECRET_DEV                # Dev JWT secret

GOOGLE_AUTH_CLIENT_ID         # Google OAuth client ID
GOOGLE_AUTH_CLIENT_SECRET     # Google OAuth client secret
```

#### SSL/Domain (Production)
```
DOMAIN_NAME                   # your-app.com
SSL_EMAIL                     # your-email@example.com
```

## Server Setup

### 1. Prepare Droplets

Run this on each droplet:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker if not already installed
sudo apt install docker.io docker-compose -y
sudo usermod -aG docker $USER

# Create app directory
mkdir -p ~/app
cd ~/app

# Install doctl (for container registry access)
wget https://github.com/digitalocean/doctl/releases/download/v1.94.0/doctl-1.94.0-linux-amd64.tar.gz
tar xf doctl-1.94.0-linux-amd64.tar.gz
sudo mv doctl /usr/local/bin

# Configure doctl
doctl auth init
```

### 2. SSL Setup (Staging/Production)

```bash
# On staging/production droplets
sudo apt install certbot -y

# Initial certificate (replace with your domain)
sudo certbot certonly --standalone -d your-app-staging.com
sudo certbot certonly --standalone -d your-app.com
```

## Deployment Flow

### Development
```bash
git checkout dev
# Make changes
git commit -m "Dev changes"
git push origin dev
# → Auto deploys to dev.your-app.com:3000
```

### Staging
```bash
git checkout staging
git merge dev
git push origin staging  
# → Auto deploys to staging.your-app.com
```

### Production
```bash
git checkout main
git merge staging
git push origin main
# → Auto deploys to your-app.com
```

## Manual Deployment Commands

If needed, deploy manually:

```bash
# Dev
ssh ubuntu@dev-server-ip
cd ~/app
git pull origin dev
npm run start

# Staging  
ssh ubuntu@staging-server-ip
cd ~/app
git pull origin staging
docker-compose -f docker-compose.staging.yml up -d

# Production
ssh ubuntu@production-server-ip
cd ~/app  
git pull origin main
docker-compose -f docker-compose.production.yml up -d
```

## Monitoring & Logs

### View logs
```bash
# On any server
docker-compose logs -f backend
docker-compose logs -f nginx
docker-compose logs -f postgres  # dev only
```

### Health checks
- Dev: `http://dev-ip:3000/health`
- Staging: `https://staging.your-app.com/health` 
- Production: `https://your-app.com/health`

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports are available
2. **SSL issues**: Check certbot renewal
3. **Database connection**: Verify managed DB connection strings
4. **Docker space**: Clean up old images with `docker system prune`

### Reset deployment
```bash
# On server
cd ~/app
docker-compose down -v
rm -f .initialized .deployed
# Redeploy
```

## Cost Optimization

### Digital Ocean Resources
- **Dev**: $6/month (1GB droplet)
- **Staging**: $18/month (2GB droplet + managed DB)  
- **Production**: $48/month (4GB droplet + managed DB + extras)

### Scaling Options
- Use App Platform for production instead of droplet
- Add load balancer for high availability
- Use CDN for static assets
- Implement database read replicas