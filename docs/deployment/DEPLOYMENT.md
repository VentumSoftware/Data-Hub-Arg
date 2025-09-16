# Deployment Guide

This guide covers deploying your Ventum Framework application to Digital Ocean.

## Quick Deploy (Manual)

### 1. First Time Setup

```bash
# Configure your droplet IP in .env
echo "DO_DEV_HOST=your.droplet.ip" >> .env

# Run the deployment script
npm run deploy
```

Choose option 2 to set up a new droplet, then option 1 to deploy.

### 2. Deploy Updates

```bash
npm run deploy
# Choose option 1: Deploy to Development
```

## Digital Ocean Setup

### Prerequisites

1. **Create a Droplet**
   - Ubuntu 22.04 LTS
   - Minimum 2GB RAM (4GB recommended)
   - Enable monitoring and backups

2. **Configure SSH Access**
   ```bash
   ssh-copy-id root@your.droplet.ip
   ```

3. **Set up DNS (Optional)**
   - Point your domain to the droplet IP
   - Configure A records for subdomains

### Initial Droplet Setup

The deployment script can automatically set up your droplet:

```bash
npm run deploy
# Choose: Setup new Droplet
# Enter your droplet IP
```

This installs:
- Docker & Docker Compose
- Node.js & npm
- Git
- Required system packages

## Automatic Deployment (GitHub Actions)

### 1. Create Deployment Branch

```bash
git checkout -b dev
git push origin dev
```

### 2. Configure GitHub Secrets

Go to GitHub → Settings → Secrets → Actions and add:

#### Required Secrets
```
APP_NAME                    # Your app name (e.g., my-app)
DO_DEV_HOST                 # Droplet IP address
DO_DEV_USER                 # SSH user (usually root)
DO_SSH_KEY                  # Your private SSH key
```

#### Database Secrets
```
DEV_POSTGRES_DB             # Database name
DEV_POSTGRES_USER           # Database user
DEV_POSTGRES_PASSWORD       # Database password
DEV_JWT_SECRET              # JWT secret for auth
```

#### Optional (for Google Auth)
```
GOOGLE_AUTH_CLIENT_ID       # Google OAuth client ID
GOOGLE_AUTH_CLIENT_SECRET   # Google OAuth secret
```

### 3. Deploy Automatically

Push to the `dev` branch:
```bash
git add .
git commit -m "Deploy to dev"
git push origin dev
```

GitHub Actions will automatically:
1. Build the application
2. Deploy to your droplet
3. Run migrations and seeds
4. Perform health checks

## Manual Deployment Steps

If you prefer manual deployment:

### 1. On Your Local Machine

```bash
# Build the application
npm run build

# Create deployment archive
tar -czf deploy.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=.env.local \
  .

# Upload to server
scp deploy.tar.gz root@your.droplet.ip:~/
```

### 2. On the Server

```bash
ssh root@your.droplet.ip

# Extract files
mkdir -p ~/app
tar -xzf deploy.tar.gz -C ~/app
cd ~/app

# Set up environment
cp .env.example .env
nano .env  # Edit with your values

# Install and start
npm install --production
docker-compose up -d --build

# Initialize database
docker exec app-backend npm run migration:push
docker exec app-backend npm run audit
docker exec app-backend npm run seed
```

## Environment Configuration

### Development (.env)
```bash
NODE_ENV=development
APP_NAME=my-app-dev
POSTGRES_DB=myapp_dev
POSTGRES_PASSWORD=dev_password_here
JWT_SECRET=dev_secret_here
```

### Production (.env)
```bash
NODE_ENV=production
APP_NAME=my-app
POSTGRES_DB=myapp_prod
POSTGRES_PASSWORD=strong_password_here
JWT_SECRET=strong_secret_here
CORS_ORIGIN=https://myapp.com
```

## SSL/HTTPS Setup

### Using Certbot (Let's Encrypt)

```bash
# Install Certbot
apt-get update
apt-get install certbot

# Get certificate
certbot certonly --standalone -d yourdomain.com

# Update docker-compose.yml to use SSL
# See docker-compose.prod.yml for example
```

### Using Cloudflare (Recommended)

1. Add your domain to Cloudflare
2. Point DNS to your droplet
3. Enable "Full SSL" mode
4. Cloudflare handles SSL termination

## Monitoring

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# From local machine
ssh root@your.droplet.ip "docker-compose logs --tail=100"
```

### Health Checks

```bash
# API health
curl http://your.droplet.ip:3000/api/health

# Frontend
curl http://your.droplet.ip:5173
```

### Resource Usage

```bash
# Docker stats
docker stats

# System resources
htop

# Disk usage
df -h
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs backend

# Restart containers
docker-compose down
docker-compose up -d

# Rebuild if needed
docker-compose build --no-cache
docker-compose up -d
```

### Database Issues

```bash
# Connect to database
docker exec -it app-postgres psql -U app_user -d app_local

# Reset database
docker-compose down -v
docker-compose up -d
# Then re-run migrations
```

### Port Conflicts

```bash
# Check what's using a port
lsof -i :3000
lsof -i :5173

# Kill process
kill -9 <PID>
```

### Disk Space Issues

```bash
# Clean up Docker
docker system prune -a
docker volume prune

# Check large files
du -sh /*
```

## Backup Strategy

### Database Backup

```bash
# Manual backup
docker exec app-postgres pg_dump -U app_user app_local > backup.sql

# Restore
docker exec -i app-postgres psql -U app_user app_local < backup.sql
```

### Automated Backups

Add to crontab:
```bash
0 2 * * * docker exec app-postgres pg_dump -U app_user app_local > /backups/db-$(date +\%Y\%m\%d).sql
```

## Scaling

### Horizontal Scaling

1. **Load Balancer**: Add nginx or HAProxy
2. **Multiple Droplets**: Deploy to multiple servers
3. **Database**: Use managed PostgreSQL

### Vertical Scaling

1. **Resize Droplet**: In Digital Ocean console
2. **Optimize Docker**: Adjust memory limits
3. **Enable Swap**: For memory-constrained systems

## Security

### Firewall Setup

```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3000/tcp  # Backend
ufw allow 5173/tcp  # Frontend
ufw enable
```

### Secure Environment

```bash
# Never commit .env files
echo ".env" >> .gitignore

# Use strong passwords
openssl rand -base64 32  # Generate secure password

# Rotate secrets regularly
```

## Cost Optimization

### Digital Ocean Pricing (Monthly)
- **Basic Droplet (1GB)**: $6
- **Standard Droplet (2GB)**: $12
- **Managed Database**: $15+
- **Spaces (S3-like)**: $5+
- **Load Balancer**: $10

### Recommendations
- Start with 2GB droplet
- Use Docker to maximize resources
- Enable monitoring to track usage
- Consider managed database for production

## Support

- **Digital Ocean Docs**: https://docs.digitalocean.com
- **Docker Docs**: https://docs.docker.com
- **GitHub Actions**: https://docs.github.com/actions