# Ventum Framework - Template Management Guide

## Overview

This framework is designed to be a living template that can be forked for new projects while maintaining the ability to receive updates from the template repository.

## Architecture

### Shared Modules (Synced from Template)
These modules contain common functionality that should be consistent across all projects:

- **Authentication** (`packages/backend/src/modules/auth/`)
  - JWT authentication
  - Google OAuth
  - Session management
  
- **User Management** (`packages/backend/src/modules/users/`)
  - User CRUD operations (ABM - Alta, Baja, Modificación)
  - Role management
  - Profile management
  
- **Common Components** (`packages/*/src/components/common/`)
  - Shared UI components
  - Layout components
  - Form components

### Custom Modules (Protected in Forks)
These directories are reserved for project-specific code:

- `packages/backend/src/modules/custom/` - Custom backend modules
- `packages/frontend/src/features/custom/` - Custom frontend features
- `packages/mobile/src/screens/custom/` - Custom mobile screens

## Workflow for New Projects

### 1. Initial Setup
```bash
# Clone the template
git clone https://github.com/jbnogal-ventum/ventum-framework.git my-project
cd my-project

# Run the setup script
npm run setup-project

# This will:
# - Rename all packages to match your project name
# - Initialize a fresh git repository
# - Create a customized README
# - Set up your .env file
```

### 2. Develop Your Custom Features
Place your project-specific code in the protected directories:

```
my-project/
├── packages/
│   ├── api/
│   │   └── src/
│   │       └── modules/
│   │           ├── auth/        # ← From template (synced)
│   │           ├── users/       # ← From template (synced)
│   │           └── custom/      # ← Your code (protected)
│   │               ├── products/
│   │               ├── orders/
│   │               └── inventory/
│   └── web/
│       └── src/
│           └── features/
│               ├── auth/        # ← From template (synced)
│               ├── users/       # ← From template (synced)
│               └── custom/      # ← Your code (protected)
│                   ├── products/
│                   ├── orders/
│                   └── inventory/
```

### 3. Sync with Template Updates

When the template receives updates (bug fixes, new features, security patches):

```bash
# Basic sync (interactive selection)
npm run sync-template

# Advanced sync (granular control)
node scripts/sync-with-template-advanced.js
```

## Sync Strategies

### 1. Selective Module Sync (Recommended)
- Choose specific modules to update
- Preserves your custom code
- Minimal conflict risk

### 2. Core Modules Only
- Updates auth, users, and common modules
- Keeps infrastructure unchanged
- Best for stable projects

### 3. Infrastructure Only
- Updates Docker, Nginx, scripts
- Doesn't touch application code
- Good for deployment improvements

### 4. Full Merge
- Merges all template changes
- May require conflict resolution
- Use when starting fresh or major updates

## Best Practices

### For Template Maintainers

1. **Keep shared modules generic**
   - Don't add business-specific logic to shared modules
   - Use configuration and hooks for customization
   - Document breaking changes clearly

2. **Version your changes**
   - Tag releases in the template repository
   - Maintain a CHANGELOG.md
   - Use semantic versioning

3. **Test thoroughly**
   - Ensure shared modules work independently
   - Test upgrade paths from previous versions
   - Provide migration scripts for breaking changes

### For Project Developers

1. **Use custom directories**
   ```typescript
   // Good: In custom module
   import { UserService } from '@modules/users/user.service';
   
   @Injectable()
   export class OrderService {
     constructor(private userService: UserService) {}
   }
   ```

2. **Extend, don't modify**
   ```typescript
   // Good: Extend base functionality
   export class CustomAuthGuard extends JwtAuthGuard {
     // Add your custom logic
   }
   
   // Bad: Modifying template files directly
   ```

3. **Regular syncs**
   - Sync monthly or when security updates are available
   - Test in a branch first
   - Review changes before merging

## Handling Conflicts

When syncing results in conflicts:

1. **Review conflicts carefully**
   ```bash
   git status                    # See conflicted files
   git diff --name-only --diff-filter=U  # List only conflicted files
   ```

2. **Resolve intelligently**
   - Keep template changes for shared modules
   - Keep your changes for custom modules
   - Test thoroughly after resolution

3. **Commit the resolution**
   ```bash
   git add .
   git commit -m "Resolved template sync conflicts"
   ```

## Migration Path

If you have an existing project and want to adopt this template structure:

1. **Reorganize your code**
   - Move custom code to `/custom` directories
   - Identify what can use shared modules

2. **Add template as remote**
   ```bash
   git remote add template https://github.com/jbnogal-ventum/ventum-framework.git
   git fetch template
   ```

3. **Cherry-pick needed features**
   ```bash
   git cherry-pick <commit-hash>  # For specific features
   ```

## Troubleshooting

### "Path not found in template"
The module structure may have changed. Check the template's current structure.

### Merge conflicts in package.json
Usually happens with dependencies. Keep your project's custom dependencies and merge template's shared ones.

### Custom code was overwritten
Ensure your custom code is in protected directories (`/custom/`). You can recover using:
```bash
git reflog  # Find the commit before sync
git checkout <hash> -- path/to/file  # Restore specific file
```

## Support

- Template Issues: [github.com/jbnogal-ventum/ventum-framework/issues](https://github.com/jbnogal-ventum/ventum-framework/issues)
- Documentation: This file and README.md
- Changelog: See releases on GitHub