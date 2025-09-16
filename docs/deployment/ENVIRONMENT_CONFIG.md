# Environment Configuration

This directory can be used to store environment-specific configuration examples or templates.

## Single Source of Truth

The application uses a **single .env file at the root** that is:
- Read by docker-compose
- Passed to all containers
- Used by both frontend and backend services

## Configuration Flow

```
.env (root)
    ↓
docker-compose.yml
    ↓
Container Environment Variables
    ↓
Application Services (frontend, backend, etc.)
```

## Best Practices

1. **Development**: Use `.env.example` as template
2. **Production**: Use environment variables from your CI/CD or secrets manager
3. **Never commit**: Real `.env` files with secrets

## Example Usage

```bash
# Create your environment file from template
cp .env.example .env

# Edit with your values
nano .env

# Start services (docker-compose will read .env automatically)
docker-compose up
```

## Security Notes

1. **Never commit actual secrets** - These files contain placeholder values
2. **Use secrets management** in production (AWS Secrets Manager, Azure Key Vault, etc.)
3. **Rotate secrets regularly** especially JWT and database passwords
4. **Use strong passwords** for production environments

## External Services Configuration

### Database Options
- **Local/Dev**: PostgreSQL in Docker
- **Staging**: Managed database (AWS RDS, Google Cloud SQL)
- **Production**: Managed database with backups and monitoring

### SFTP/File Storage Options
- **Local/Dev**: SFTP container
- **Staging**: SFTP container or cloud storage
- **Production**: Cloud storage (AWS S3, Azure Blob, GCS)

### Additional Services
- **Redis**: For caching and sessions
- **Monitoring**: Sentry, New Relic, DataDog
- **Logging**: CloudWatch, ELK Stack, Splunk