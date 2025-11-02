# GitHub Actions Deployment Setup Guide

Since you've already created your DigitalOcean droplet manually, here's how to set up GitHub Actions to deploy to it automatically.

## Step 1: Get Your Droplet Information

On your droplet, run:

```bash
# Get your droplet's IP address
ip addr show | grep "inet " | grep -v 127.0.0.1

# Or if you know the interface name (usually eth0 or ens3)
ip addr show eth0 | grep "inet " | awk '{print $2}' | cut -d/ -f1
```

## Step 2: Set Up SSH Key for GitHub Actions

### Option A: Use Existing SSH Key

If you already have an SSH key on your local machine that can access the droplet:

```bash
# Display your private key
cat ~/.ssh/id_rsa
# Or if you used a different key:
cat ~/.ssh/your_key_name
```

Copy the entire output (including `-----BEGIN` and `-----END` lines).

### Option B: Create New SSH Key for GitHub Actions

On your droplet:

```bash
# Create a dedicated user for deployments (recommended)
sudo adduser deployer
sudo usermod -aG sudo deployer
sudo usermod -aG docker deployer

# Switch to deployer user
su - deployer

# Generate SSH key
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions_key -N ""

# Add public key to authorized_keys
cat ~/.ssh/github_actions_key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Display the private key (copy this for GitHub Secrets)
cat ~/.ssh/github_actions_key

# Display the public key (keep this for reference)
cat ~/.ssh/github_actions_key.pub
```

## Step 3: Configure GitHub Repository Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:

### Required Secrets:

1. **DO_SSH_PRIVATE_KEY**
   - The private SSH key from Step 2
   - Copy the ENTIRE key including header/footer

2. **DEV_SERVER_HOST**
   - Your droplet's IP address
   - Example: `164.90.123.456`

3. **DEV_SERVER_USER**
   - Username to SSH into (either `root` or `deployer`)
   - Recommended: `deployer`

### Database Secrets:

4. **DEV_POSTGRES_DB**
   - Value: `indexes_dev`

5. **DEV_POSTGRES_USER**
   - Value: `indexes_user`

6. **DEV_POSTGRES_PASSWORD**
   - Generate with: `openssl rand -base64 32`

### Application Secrets:

7. **DEV_COOKIE_SECRET**
   - Generate with: `openssl rand -hex 32`

8. **AUTH_TOKEN**
   - Generate with: `openssl rand -hex 32`

### Optional Secrets (for Google OAuth):

9. **GOOGLE_AUTH_CLIENT_ID**
   - Your Google OAuth client ID

10. **GOOGLE_AUTH_CLIENT_SECRET**
    - Your Google OAuth client secret

### Optional Secrets (for Cloudflare - if using):

11. **CLOUDFLARE_API_TOKEN**
    - Get from Cloudflare dashboard

12. **CLOUDFLARE_ZONE_ID**
    - Your domain's zone ID from Cloudflare

## Step 4: Update the Deployment Workflow

Since you already have a droplet, we need to modify the workflow to skip droplet creation. Create this simplified version:

```bash
# On your local machine
nano .github/workflows/deploy-dev-simple.yml
```

Copy this content:

```yaml
name: Deploy to Dev (Manual Droplet)

on:
  push:
    branches: [dev]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy to Server
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.DEV_SERVER_HOST }}
          username: ${{ secrets.DEV_SERVER_USER }}
          key: ${{ secrets.DO_SSH_PRIVATE_KEY }}
          script: |
            # Navigate to app directory or create it
            if [ ! -d "/home/${{ secrets.DEV_SERVER_USER }}/data-hub-arg" ]; then
              cd /home/${{ secrets.DEV_SERVER_USER }}
              git clone -b dev ${{ github.server_url }}/${{ github.repository }}.git data-hub-arg
            fi

            cd /home/${{ secrets.DEV_SERVER_USER }}/data-hub-arg

            # Pull latest changes
            git fetch origin
            git reset --hard origin/dev
            git clean -fd

            # Create/update .env file
            cat > .env << 'EOL'
            APP_NAME=indexes-app
            NODE_ENV=development

            # Database
            POSTGRES_DB=${{ secrets.DEV_POSTGRES_DB }}
            POSTGRES_USER=${{ secrets.DEV_POSTGRES_USER }}
            POSTGRES_PASSWORD=${{ secrets.DEV_POSTGRES_PASSWORD }}
            POSTGRES_HOST=postgres
            POSTGRES_PORT=5432
            DATABASE_URL=postgresql://${{ secrets.DEV_POSTGRES_USER }}:${{ secrets.DEV_POSTGRES_PASSWORD }}@postgres:5432/${{ secrets.DEV_POSTGRES_DB }}

            # Security
            COOKIE_SECRET=${{ secrets.DEV_COOKIE_SECRET }}
            AUTH_TOKEN=${{ secrets.AUTH_TOKEN }}
            SESSION_EXPIRATION_MINUTES=120

            # Google OAuth (optional)
            GOOGLE_AUTH_CLIENT_ID=${{ secrets.GOOGLE_AUTH_CLIENT_ID }}
            GOOGLE_AUTH_CLIENT_SECRET=${{ secrets.GOOGLE_AUTH_CLIENT_SECRET }}
            GOOGLE_AUTH_CALLBACK_URL=http://${{ secrets.DEV_SERVER_HOST }}:8080/api/access/google/redirect
            GOOGLE_AUTH_RETURN_URL=http://${{ secrets.DEV_SERVER_HOST }}:8080

            # URLs
            FE_URL=http://${{ secrets.DEV_SERVER_HOST }}:8080
            VITE_API_URL=http://${{ secrets.DEV_SERVER_HOST }}:8080

            # Ports
            NGINX_HTTP_PORT=80
            POSTGRES_EXTERNAL_PORT=5434
            RABBITMQ_MANAGEMENT_PORT=15673
            OPENSEARCH_PORT=9201
            OPENSEARCH_DASHBOARDS_PORT=5602
            SFTP_PORT=2223
            EOL

            # Stop existing containers
            docker compose --env-file .env -f devops/docker/docker-compose.dev.yml down || true

            # Clean up old images
            docker system prune -f

            # Build and start containers
            docker compose --env-file .env -f devops/docker/docker-compose.dev.yml up -d --build

            # Wait for database to be ready
            echo "Waiting for database..."
            sleep 15

            # Run migrations (using the db.js script)
            docker exec indexes-app-api-dev npm run migration:push || echo "Migration skipped or failed"

            # Show container status
            docker ps

            echo "✅ Deployment complete!"
            echo "🌐 Access your app at: http://${{ secrets.DEV_SERVER_HOST }}:8080"

      - name: Output Deployment Info
        run: |
          echo "## 🚀 Deployment Successful!" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "### 🌐 Access Points:" >> $GITHUB_STEP_SUMMARY
          echo "- **Application**: http://${{ secrets.DEV_SERVER_HOST }}:8080" >> $GITHUB_STEP_SUMMARY
          echo "- **API**: http://${{ secrets.DEV_SERVER_HOST }}:8080/api" >> $GITHUB_STEP_SUMMARY
          echo "- **API Docs**: http://${{ secrets.DEV_SERVER_HOST }}:8080/api/docs" >> $GITHUB_STEP_SUMMARY
          echo "- **OpenSearch Dashboards**: http://${{ secrets.DEV_SERVER_HOST }}:5602" >> $GITHUB_STEP_SUMMARY
          echo "- **RabbitMQ Management**: http://${{ secrets.DEV_SERVER_HOST }}:15673" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "### 🔧 SSH Access:" >> $GITHUB_STEP_SUMMARY
          echo "\`\`\`bash" >> $GITHUB_STEP_SUMMARY
          echo "ssh ${{ secrets.DEV_SERVER_USER }}@${{ secrets.DEV_SERVER_HOST }}" >> $GITHUB_STEP_SUMMARY
          echo "\`\`\`" >> $GITHUB_STEP_SUMMARY
```

## Step 5: Test SSH Access

Before pushing, verify SSH access works:

```bash
# From your local machine
ssh deployer@YOUR_DROPLET_IP

# If using root
ssh root@YOUR_DROPLET_IP
```

## Step 6: Prepare Droplet for First Deployment

SSH into your droplet and run:

```bash
# As deployer or root user
cd ~

# Make sure Docker is running
sudo systemctl status docker

# Clone the repo manually for the first time
git clone -b dev https://github.com/YOUR_USERNAME/data-hub-arg.git

cd data-hub-arg

# You can do a manual deployment first to test
# (The GitHub Action will overwrite this, but it's good to test)
```

## Step 7: Configure Firewall

On your droplet:

```bash
# Allow necessary ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 8080/tcp # Nginx proxy
sudo ufw enable
sudo ufw status
```

## Step 8: Trigger Deployment

### Option A: Push to dev branch

```bash
# On your local machine
git checkout dev
git push origin dev
```

### Option B: Manual trigger

1. Go to GitHub → Actions tab
2. Select "Deploy to Dev (Manual Droplet)" workflow
3. Click "Run workflow" button
4. Select the `dev` branch
5. Click "Run workflow"

## Step 9: Monitor Deployment

1. Go to GitHub → Actions tab
2. Click on the running workflow
3. Watch the deployment logs in real-time
4. Check the summary at the end for access URLs

## Step 10: Verify Deployment

Once deployed, access:

```bash
# Check if services are running
ssh deployer@YOUR_DROPLET_IP
cd ~/data-hub-arg
docker ps

# Check logs
docker logs indexes-app-api-dev
docker logs indexes-app-web-dev
docker logs indexes-app-nginx-dev
```

Access in browser:
- Application: `http://YOUR_DROPLET_IP:8080`
- API: `http://YOUR_DROPLET_IP:8080/api`

## Troubleshooting

### SSH connection fails

```bash
# Check SSH key permissions on droplet
ls -la ~/.ssh/
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

### Containers won't start

```bash
# Check Docker logs
cd ~/data-hub-arg
docker compose logs

# Check disk space
df -h

# Check memory
free -h
```

### Database migrations fail

```bash
# Run migrations manually
cd ~/data-hub-arg
npm run db:migrate
npm run db:seed
```

### Port already in use

```bash
# Find what's using the port
sudo lsof -i :80
sudo lsof -i :8080

# Stop nginx if it's running outside Docker
sudo systemctl stop nginx
sudo systemctl disable nginx
```

## Next Steps: Add Custom Domain

Once this is working, you can:
1. Point your domain to the droplet IP in Cloudflare
2. Update nginx config to use your domain
3. Get SSL certificate with Let's Encrypt

See `DEPLOYMENT.md` for full instructions.

## Generate Secrets Helper Script

Save this as `generate-secrets.sh`:

```bash
#!/bin/bash

echo "=== GitHub Secrets Generator ==="
echo ""
echo "Copy these values to GitHub Secrets:"
echo ""
echo "DEV_POSTGRES_PASSWORD:"
openssl rand -base64 32
echo ""
echo "DEV_COOKIE_SECRET:"
openssl rand -hex 32
echo ""
echo "AUTH_TOKEN:"
openssl rand -hex 32
echo ""
```

Run it:
```bash
chmod +x generate-secrets.sh
./generate-secrets.sh
```
