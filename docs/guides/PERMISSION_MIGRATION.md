# Permission System Migration Guide

## Overview

This guide helps migrate from the existing colon-based permission naming (`:`) to the dot-based naming (`.`) for better consistency with the new RBAC/ABAC system.

## Recommended Naming Convention

### Current (Colon-based)
```
fs:read:node
users:create
companies:read
```

### Recommended (Dot-based)
```
fs.read.node
users.create
companies.read
```

## Migration Options

### Option 1: Gradual Migration (Recommended)

Keep both naming conventions working during transition:

1. **Add new permissions** with dot notation
2. **Update decorators** to use dot notation for new features
3. **Gradually migrate** existing permissions
4. **Deprecate** colon notation over time

### Option 2: Full Migration

Replace all existing permissions at once:

1. **Update all seed files** to use dot notation
2. **Run database migration** to update existing permissions
3. **Update all code** using old permission names

## Permission Naming Best Practices

### Hierarchical Structure
```
domain.action.resource.modifier
```

### Examples
```
# File system
fs.read.file
fs.write.file
fs.delete.file
fs.admin.all

# User management  
users.read.profile
users.edit.profile
users.create.account
users.delete.account
users.admin.all

# Company operations
companies.read.info
companies.edit.details
companies.create.new
companies.delete.company

# Scoped permissions (same name, applied with scope)
projects.read     # Global: read all projects
projects.read     # Scoped: read projects in specific company
projects.edit     # Scoped: edit specific project
```

## Mapping Table

| Current (Colon) | New (Dot) | Description |
|-----------------|-----------|-------------|
| `fs:read:node` | `fs.read.node` | Read file/directory info |
| `fs:list:directory` | `fs.list.directory` | List directory contents |
| `fs:upload:file` | `fs.upload.file` | Upload files |
| `users:read` | `users.read` | Read user information |
| `users:create` | `users.create` | Create new users |
| `companies:read` | `companies.read` | Read company data |
| `projects:update` | `projects.edit` | Edit project (renamed for clarity) |
| `system:admin` | `admin.access` | Administrative access |

## Implementation Strategy

### 1. Update Seed Files

Create new seed files with dot notation while keeping old ones:

```yaml
# permissions-v2.yml
permissions:
  - name: users.read
    label: Read Users
    group: user-management
    description: View user information
  
  - name: companies.read
    label: Read Companies  
    group: company-management
    description: View company information
```

### 2. Update Permission Decorators

```typescript
// Old style
@RequirePermissions([{ permission: 'users:read' }])

// New style
@RequirePermissions([{ permission: 'users.read' }])
```

### 3. Update Database

```sql
-- Migration to rename permissions
UPDATE permissions SET name = 'users.read' WHERE name = 'users:read';
UPDATE permissions SET name = 'companies.read' WHERE name = 'companies:read';
-- ... etc for all permissions
```

### 4. Backwards Compatibility

Create a permission alias system during transition:

```typescript
const PERMISSION_ALIASES = {
  'users:read': 'users.read',
  'companies:read': 'companies.read',
  // ... etc
};

// In PermissionGuard
private normalizePermissionName(permission: string): string {
  return PERMISSION_ALIASES[permission] || permission;
}
```

## New Permissions for Enhanced System

Add these permissions to support the new RBAC/ABAC features:

```yaml
permissions:
  # Administrative access
  - name: admin.access
    label: Admin Panel Access
    group: administration
    description: Access to admin features
    
  - name: admin.system.analysis
    label: System Analysis
    group: administration
    description: System debugging and analysis
  
  # Management levels
  - name: management.access
    label: Management Access
    group: management
    description: Management-level features
    
  # Profile management
  - name: profile.read
    label: Read Profile
    group: profile
    description: Read own profile
    
  - name: profile.edit
    label: Edit Profile
    group: profile  
    description: Edit own profile
    
  # Permission debugging
  - name: permissions.debug
    label: Debug Permissions
    group: system
    description: Access permission debugging tools
    
  # Data access levels
  - name: data.sensitive.read
    label: Read Sensitive Data
    group: data-access
    description: Access sensitive/classified data
    
  - name: data.financial.read
    label: Read Financial Data
    group: data-access
    description: Access financial information
```

## Testing Migration

### 1. Create Test Cases

```typescript
describe('Permission Migration', () => {
  test('old permission names still work', async () => {
    // Test backwards compatibility
    const hasPermission = await checkPermission('users:read');
    expect(hasPermission).toBe(true);
  });
  
  test('new permission names work', async () => {
    // Test new naming
    const hasPermission = await checkPermission('users.read');
    expect(hasPermission).toBe(true);
  });
});
```

### 2. Validation Scripts

```bash
#!/bin/bash
# Check for permission naming inconsistencies

echo "Checking for colon-based permissions in code..."
grep -r "permission.*:" packages/api/src/ || echo "No colon permissions found"

echo "Checking for dot-based permissions in code..."
grep -r "permission.*\." packages/api/src/ || echo "No dot permissions found"
```

## Timeline Recommendation

### Phase 1 (Week 1-2): Setup
- [ ] Create new permission seed files with dot notation
- [ ] Add backwards compatibility layer
- [ ] Update documentation

### Phase 2 (Week 3-4): New Features
- [ ] Use dot notation for all new permissions
- [ ] Update permission decorators in new code
- [ ] Add enhanced permissions for ABAC

### Phase 3 (Week 5-8): Migration
- [ ] Gradually update existing endpoints
- [ ] Update all role definitions
- [ ] Migrate database permission names

### Phase 4 (Week 9-10): Cleanup
- [ ] Remove backwards compatibility
- [ ] Remove old seed files
- [ ] Update all documentation

## Rollback Plan

If issues occur during migration:

1. **Revert seed files** to original versions
2. **Run database rollback** migration
3. **Update code** to use original permission names
4. **Test thoroughly** before re-attempting migration

## Benefits After Migration

- **Consistent naming** across the entire system
- **Better IDE support** with dot notation
- **Clearer hierarchy** in permission names
- **Enhanced ABAC integration** with new permissions
- **Improved debugging** with systematic naming