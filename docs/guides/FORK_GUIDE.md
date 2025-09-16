# Creating a New Project from Ventum Framework

This guide explains how to create a new project using the Ventum Framework as a template.

## Method 1: Quick Setup Script (Recommended)

```bash
# Clone the template
git clone https://github.com/your-org/ventum-framework.git my-new-project
cd my-new-project

# Run the setup script (cross-platform)
npm run setup-project my-new-project

# Start your project
npm run start
```

The setup script will:
- ✅ Update all package.json files with your project name
- ✅ Configure environment variables
- ✅ Update the README with your project information
- ✅ Initialize a fresh Git repository
- ✅ Prepare for GitHub deployment (optional)

## Method 2: GitHub Template Repository

1. **Use as Template on GitHub:**
   - Go to the Ventum Framework repository
   - Click "Use this template" button
   - Name your new repository
   - Clone your new repository locally

2. **Run Setup:**
   ```bash
   # Clone your new repository
   git clone https://github.com/YOUR_USERNAME/YOUR_PROJECT.git
   cd YOUR_PROJECT
   
   # Run setup script
   npm run setup-project YOUR_PROJECT
   ```

## Method 3: Manual Fork and Setup

1. **Fork on GitHub:**
   - Fork the Ventum Framework repository
   - Clone your fork locally

2. **Manual Configuration:**
   ```bash
   # Clone your fork
   git clone https://github.com/YOUR_USERNAME/YOUR_FORK.git
   cd YOUR_FORK
   ```

3. **Update Project Name:**
   - Edit `package.json` and all `packages/*/package.json` files
   - Update the `name` field to your project name
   - Update `@app/*` references to `@your-project/*`

4. **Configure Environment:**
   ```bash
   cp .env.example .env
   # Edit .env and set APP_NAME=your-project
   ```

5. **Reset Git History (Optional):**
   ```bash
   rm -rf .git
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_REPO_URL
   git push -u origin main
   ```

## Post-Setup Configuration

### 1. Google OAuth Setup (Optional)
If you want to use Google authentication:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/api/access/google/redirect`
6. Update `.env` with your credentials:
   ```bash
   GOOGLE_AUTH_CLIENT_ID=your_client_id
   GOOGLE_AUTH_CLIENT_SECRET=your_client_secret
   ```

### 2. Database Configuration
Default PostgreSQL credentials in `.env`:
```bash
POSTGRES_DB=app_local
POSTGRES_USER=app_user
POSTGRES_PASSWORD=app_password  # Change this for production!
```

### 3. Customize Branding
- Replace Ventum logos/branding in:
  - `packages/frontend/src/components/VentumLogo.tsx`
  - `packages/frontend/src/pages/landing/Landing.tsx`
  - `packages/frontend/src/pages/signIn/SignIn.tsx`

### 4. Update Deployment Configuration
For production deployment:
1. Update `docker-compose.prod.yml` with your domain
2. Configure GitHub Actions secrets for CI/CD
3. Set up your cloud provider (Digital Ocean, AWS, etc.)

## Project Structure After Setup

```
your-project/
├── packages/
│   ├── backend/          # NestJS backend
│   ├── frontend/         # React frontend
│   └── shared/           # Shared code
├── services/
│   ├── nginx/            # Reverse proxy
│   └── sftp/             # File server
├── .env                  # Your configuration
├── docker-compose.yml    # Docker setup
├── start.sh/start.bat    # Start scripts
└── README.md             # Your project docs
```

## First Run

After setup, start your project:

```bash
npm run start
```

This will:
1. Install dependencies
2. Build Docker images
3. Start all services
4. Run database migrations
5. Set up audit tables (CDC)
6. Seed initial data

Access your application at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## Troubleshooting

### Permission Issues
If you get permission errors on Linux/macOS, the Node.js scripts should still work through npm.

### Docker Not Starting
- Ensure Docker Desktop is running
- Check port availability (3000, 5173, 5432)
- Review logs: `docker-compose logs`

### Database Connection Failed
- Wait for PostgreSQL to fully start (10-15 seconds)
- Check credentials in `.env`
- Verify container is running: `docker ps`

## Next Steps

1. **Development:**
   - Modify code in `packages/` directories
   - Hot reload is enabled for both frontend and backend

2. **Add Features:**
   - Create new API endpoints in `packages/backend/src`
   - Add React components in `packages/frontend/src`
   - Share types in `packages/shared`

3. **Deploy:**
   - See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment
   - Configure CI/CD with GitHub Actions
   - Set up monitoring and logging

## Support

- Template Issues: [Ventum Framework Issues](https://github.com/your-org/ventum-framework/issues)
- Documentation: [Ventum Framework Wiki](https://github.com/your-org/ventum-framework/wiki)

Happy coding! 🚀