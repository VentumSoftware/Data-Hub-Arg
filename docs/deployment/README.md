# Deployment Documentation

This directory contains all deployment-related documentation for the Ventum Framework.

## Quick Navigation

### 🚀 Getting Started
- **[DEPLOY_TEST_GUIDE.md](./DEPLOY_TEST_GUIDE.md)** - Step-by-step guide for your first deployment
- **[DEV_DEPLOYMENT_SETUP.md](./DEV_DEPLOYMENT_SETUP.md)** - Development environment setup

### 📋 Deployment Strategies
- **[CI_CD_GUIDE.md](./CI_CD_GUIDE.md)** - Complete CI/CD pipeline documentation
- **[GITHUB_DEPLOYMENT.md](./GITHUB_DEPLOYMENT.md)** - GitHub Actions auto-deployment
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Manual deployment guide

## Deployment Overview

### Environments

| Environment | Domain | Deployment Method | Infrastructure |
|------------|--------|------------------|----------------|
| Development | `your-app.dev.ventum.dev` | Push to `dev` branch | DigitalOcean Droplet |
| Staging | `your-app.staging.ventum.dev` | Push to `staging` branch | DO App Platform |
| Production | `your-app.ventum.dev` | Git tag `v*` | Kubernetes (DOKS) |

### Quick Start

1. **Local Development**
   ```bash
   npm run start
   ```

2. **Deploy to Development**
   ```bash
   git checkout -b dev
   git push origin dev
   ```

3. **Deploy to Production**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

### Required Secrets

Configure these in GitHub Settings → Secrets → Actions:

- `DIGITALOCEAN_ACCESS_TOKEN`
- `DO_SSH_KEY_FINGERPRINT`
- `DO_SSH_PRIVATE_KEY`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`

See individual guides for detailed setup instructions.

### Environment Configuration

For details on environment variables and configuration management, see [ENVIRONMENT_CONFIG.md](./ENVIRONMENT_CONFIG.md).