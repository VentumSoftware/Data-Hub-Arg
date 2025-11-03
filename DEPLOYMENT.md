# Deployment Guide - DigitalOcean + Cloudflare

## Prerequisites
- DigitalOcean account
- Domain name
- Cloudflare account (free tier)

## Step 1: Create DigitalOcean Droplet

1. **Choose Droplet Specs:**
   - **OS:** Ubuntu 22.04 LTS
   - **Plan:** Basic ($12/month recommended for production)
     - 2 GB RAM / 1 vCPU / 50 GB SSD
     - Or $24/month for better performance (4 GB RAM)
   - **Datacenter:** Choose closest to your users
   - **Authentication:** SSH keys (recommended) or password

2. **Initial Server Setup:**
```bash
# SSH into your droplet
ssh root@your_droplet_ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Create a non-root user (recommended)
adduser deployer
usermod -aG sudo deployer
usermod -aG docker deployer

# Switch to deployer user
su - deployer
```

## Step 2: Deploy Application

### Option A: Manual Deployment (Simple)

```bash
# Clone repository
git clone <your-repo-url>
cd data-hub-arg

# Create production .env file
cp .env.example .env
nano .env  # Edit with production values

# Set production values
export APP_NAME=indexes-app
export POSTGRES_PASSWORD=<strong-password>
export COOKIE_SECRET=<generate-random-secret>
export AUTH_TOKEN=<generate-random-token>
# ... other env vars

# Start production services
npm run start:prod

# Check if services are running
docker ps
```

### Option B: Automated Deployment with GitHub Actions (Recommended)

Create `.github/workflows/deploy-dev.yml`:

```yaml
name: Deploy to Dev Server

on:
  push:
    branches: [dev]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to DigitalOcean
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.DEV_SERVER_HOST }}
          username: ${{ secrets.DEV_SERVER_USER }}
          key: ${{ secrets.DEV_SERVER_SSH_KEY }}
          script: |
            cd /home/deployer/data-hub-arg
            git pull origin dev
            docker compose --env-file .env -f devops/docker/docker-compose.yml down
            docker compose --env-file .env -f devops/docker/docker-compose.yml up -d --build
            docker system prune -af
```

## Step 3: Configure Cloudflare

### 3.1 Add Domain to Cloudflare

1. Sign up at https://cloudflare.com
2. Click "Add a site"
3. Enter your domain name
4. Choose Free plan
5. Cloudflare will scan your DNS records

### 3.2 Update Nameservers

1. Copy the Cloudflare nameservers (e.g., `ns1.cloudflare.com`)
2. Go to your domain registrar (GoDaddy, Namecheap, etc.)
3. Update nameservers to Cloudflare's nameservers
4. Wait for DNS propagation (can take up to 24 hours)

### 3.3 Configure DNS Records

In Cloudflare DNS settings, add:

```
Type    Name              Content              Proxy status
A       @                 your_droplet_ip      Proxied (orange cloud)
A       www               your_droplet_ip      Proxied (orange cloud)
CNAME   api               yourdomain.com       Proxied (orange cloud)
```

### 3.4 SSL/TLS Configuration

1. Go to SSL/TLS → Overview
2. Set encryption mode to **Full (strict)**
3. Go to SSL/TLS → Edge Certificates
4. Enable "Always Use HTTPS"
5. Enable "Automatic HTTPS Rewrites"

## Step 4: Configure Nginx for Production

Update `devops/docker/docker-compose.yml` to expose port 80 and 443:

```yaml
nginx:
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./services/nginx/nginx.prod.conf:/etc/nginx/nginx.conf:ro
    - ./services/nginx/ssl:/etc/nginx/ssl:ro
    - certbot-etc:/etc/letsencrypt
    - certbot-var:/var/lib/letsencrypt
```

Create `services/nginx/nginx.prod.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Upstream backend
    upstream backend {
        server api:3000;
    }
    
    # Upstream frontend
    upstream frontend {
        server web:80;
    }

    # HTTP redirect to HTTPS
    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com;
        
        # Allow Cloudflare validation
        location /.well-known/ {
            allow all;
        }
        
        # Redirect all HTTP to HTTPS
        location / {
            return 301 https://$host$request_uri;
        }
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name yourdomain.com www.yourdomain.com;

        # Cloudflare Origin Certificate (or Let's Encrypt)
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        
        # SSL configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Security headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # API routes
        location /api {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Frontend routes
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

## Step 5: Get SSL Certificate

### Option A: Cloudflare Origin Certificate (Recommended)

1. In Cloudflare, go to SSL/TLS → Origin Server
2. Click "Create Certificate"
3. Choose:
   - Generate private key and CSR with Cloudflare
   - Hostnames: `yourdomain.com`, `*.yourdomain.com`
   - Certificate Validity: 15 years
4. Copy the certificate and private key
5. Save on server:

```bash
# On your droplet
mkdir -p services/nginx/ssl
nano mkdir -p services/nginx/ssl  # Paste certificate
nano services/nginx/ssl/key.pem   # Paste private key
chmod 600 services/nginx/ssl/key.pem
```

### Option B: Let's Encrypt (Alternative)

```bash
# Install certbot
docker run -it --rm --name certbot \
  -v "certbot-etc:/etc/letsencrypt" \
  -v "certbot-var:/var/lib/letsencrypt" \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  -d yourdomain.com -d www.yourdomain.com
```

## Step 6: Environment Variables

Create production `.env`:

```bash
# Application
APP_NAME=indexes-app
NODE_ENV=production

# Database
POSTGRES_DB=indexes_prod
POSTGRES_USER=indexes_user
POSTGRES_PASSWORD=<generate-strong-password>
POSTGRES_EXTERNAL_PORT=5432

# Security
COOKIE_SECRET=<generate-random-secret-64-chars>
AUTH_TOKEN=<generate-random-token-64-chars>

# URLs
FE_URL=https://yourdomain.com
VITE_API_URL=https://yourdomain.com

# Google OAuth (if using)
GOOGLE_AUTH_CLIENT_ID=your-client-id
GOOGLE_AUTH_CLIENT_SECRET=your-client-secret
GOOGLE_AUTH_CALLBACK_URL=https://yourdomain.com/api/access/google/redirect
GOOGLE_AUTH_RETURN_URL=https://yourdomain.com

# Ports
NGINX_HTTP_PORT=80
NGINX_HTTPS_PORT=443
```

Generate secrets:
```bash
# Generate strong passwords
openssl rand -hex 32  # For COOKIE_SECRET
openssl rand -hex 32  # For AUTH_TOKEN
openssl rand -base64 32  # For POSTGRES_PASSWORD
```

## Step 7: Firewall Configuration

```bash
# Enable UFW firewall
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

## Step 8: Deploy and Verify

```bash
# Build and start services
docker compose --env-file .env -f devops/docker/docker-compose.yml up -d --build

# Check logs
docker compose --env-file .env -f devops/docker/docker-compose.yml logs -f

# Verify services are running
docker ps

# Run migrations
npm run db:migrate
npm run db:seed
```

## Step 9: Monitoring & Maintenance

### Set up automatic backups

```bash
# Create backup script
cat > /home/deployer/backup.sh << 'SCRIPT'
#!/bin/bash
BACKUP_DIR="/home/deployer/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
docker exec indexes-app-postgres-prod pg_dump -U indexes_user indexes_prod > \
  $BACKUP_DIR/db_backup_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "db_backup_*.sql" -mtime +7 -delete
SCRIPT

chmod +x /home/deployer/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /home/deployer/backup.sh
```

### Set up log rotation

```bash
sudo nano /etc/logrotate.d/docker-containers
```

Add:
```
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    size=10M
    missingok
    delaycompress
    copytruncate
}
```

## Architecture Diagram

```
User Request (yourdomain.com)
    ↓
Cloudflare (CDN + SSL + DDoS Protection)
    ↓
DigitalOcean Droplet (Ubuntu 22.04)
    ↓
Nginx (Port 443) - Reverse Proxy
    ├── /api → Backend API (NestJS on port 3000)
    └── /    → Frontend (React/Vite on port 80)
```

## Cost Breakdown

- **DigitalOcean Droplet:** $12-24/month
- **Domain Name:** $10-15/year
- **Cloudflare:** Free (Pro is $20/month if needed)
- **Total:** ~$15-30/month

## Troubleshooting

### Services won't start
```bash
# Check logs
docker compose logs -f

# Check disk space
df -h

# Check memory
free -h
```

### Can't connect to domain
```bash
# Check DNS propagation
dig yourdomain.com
nslookup yourdomain.com

# Check nginx
docker exec indexes-app-nginx-prod nginx -t
```

### SSL issues
- Verify Cloudflare SSL mode is "Full (strict)"
- Check certificate files exist in nginx container
- Restart nginx: `docker restart indexes-app-nginx-prod`
