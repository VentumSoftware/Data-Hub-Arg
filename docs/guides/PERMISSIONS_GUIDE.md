# Hybrid RBAC/ABAC Permission System Guide

## Overview

The Ventum Framework includes a robust hybrid permission system that combines:
- **RBAC (Role-Based Access Control)**: Users → Roles → Permissions
- **ABAC (Attribute-Based Access Control)**: User attributes for fine-grained control
- **Scope-based permissions**: Global or entity-specific permissions
- **Multiple permission sources**: Direct, role-based, and group-based permissions

## Key Concepts

### 1. Permission Sources
Users can receive permissions from three sources:
- **Direct**: Permissions assigned directly to the user
- **Roles**: Permissions inherited from assigned roles
- **Groups**: Permissions inherited from user groups

### 2. Scope System
Permissions can be:
- **Global**: Apply everywhere (scope = null)
- **Scoped**: Limited to specific entities (e.g., company, project)

### 3. Scope Inheritance
- If a permission in a role has no scope → inherits role's scope
- If a permission in a role has its own scope → uses that scope
- If both are null → permission is global

### 4. User Attributes (ABAC)
Users have a JSON `attributes` field for fine-grained access control:
```json
{
  "department": "HR",
  "level": "manager",
  "clearanceLevel": "L3",
  "region": "US",
  "projects": [1, 2, 3]
}
```

## Database Schema

### Core Tables
```sql
-- Users with ABAC attributes
users (
  id, email, firstName, lastName, 
  attributes JSONB  -- ABAC attributes
)

-- Permissions
permissions (
  id, name, label, permissionGroup, description
)

-- Roles
roles (
  id, name, label, roleGroup, description
)

-- User Groups
usersGroups (
  id, name
)
```

### Permission Assignment Tables
```sql
-- Direct user permissions (with optional scope)
permissionsUsersMap (
  permissionId, userId,
  referenceableType VARCHAR(50),  -- scope type: 'company', 'project', etc.
  referenceableId INTEGER         -- scope id: 123, 456, etc.
)

-- Role assignments to users (with optional scope)
usersRolesMap (
  userId, roleId,
  referenceableType VARCHAR(50),  -- role scope
  referenceableId INTEGER         -- role scope id  
)

-- Permissions within roles (with optional scope override)
permissionsRolesMap (
  permissionId, roleId,
  referenceableType VARCHAR(50),  -- permission override scope
  referenceableId INTEGER         -- permission override scope id
)

-- Group assignments
usersGroupsMap (userId, usersGroupId)

-- Group permissions
permissionsGroupsMap (
  permissionId, usersGroupId,
  referenceableType VARCHAR(50),  -- group permission scope
  referenceableId INTEGER         -- group permission scope id
)
```

## Usage Examples

### 1. Basic Global Permissions

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../guards/auth.guard';
import { PermissionGuard } from '../guards/permission.guard';
import { RequirePermissions, CanReadUsers } from '../decorators/permissions.decorator';

@Controller('users')
@UseGuards(AuthGuard, PermissionGuard)
export class UsersController {
  
  @Get()
  @RequirePermissions([{ permission: 'users.read' }])
  // OR use the helper decorator:
  // @CanReadUsers()
  async getUsers() {
    return { users: [] };
  }
}
```

### 2. Scoped Permissions

```typescript
@Controller('companies')
@UseGuards(AuthGuard, PermissionGuard)
export class CompaniesController {

  // Permission scoped to specific company from URL params
  @Get(':companyId/users')
  @RequirePermissions([
    PermissionHelpers.scoped('users.read', 'company', 'companyId')
  ])
  async getCompanyUsers(@Param('companyId') companyId: number) {
    return { companyId, users: [] };
  }

  // Permission scoped to company from request body
  @Post('users')
  @RequirePermissions([
    PermissionHelpers.scopedFromBody('users.create', 'company', 'companyId')
  ])
  async createUser(@Body() data: { companyId: number; name: string }) {
    return { created: data };
  }

  // Permission scoped to company from query parameters
  @Get('reports')
  @RequirePermissions([
    PermissionHelpers.scopedFromQuery('reports.read', 'company', 'companyId')
  ])
  async getReports() {
    return { reports: [] };
  }
}
```

### 3. Attribute-Based (ABAC) Permissions

```typescript
@Controller('admin')
@UseGuards(AuthGuard, PermissionGuard)
export class AdminController {

  // Only HR department users
  @Delete('users/:id')
  @RequirePermissions([{
    permission: 'users.delete',
    attributes: { department: 'HR' }
  }])
  async deleteUser(@Param('id') id: number) {
    return { deleted: id };
  }

  // Multiple attribute values (OR logic)
  @Get('sensitive-data')
  @RequirePermissions([{
    permission: 'data.sensitive.read',
    attributes: { 
      clearanceLevel: ['L4', 'L5'],  // L4 OR L5
      department: 'Security'         // AND Security department
    }
  }])
  async getSensitiveData() {
    return { data: 'classified' };
  }

  // Use helper decorators
  @Get('admin-panel')
  @RequireAdmin()  // Checks for admin.access permission + role: 'admin' attribute
  async getAdminPanel() {
    return { panel: 'admin' };
  }
}
```

### 4. Complex Hybrid Permissions

```typescript
@Controller('projects')
@UseGuards(AuthGuard, PermissionGuard)
export class ProjectsController {

  // Requires:
  // 1. projects.edit permission scoped to the specific project
  // 2. User must be in HR or Management department  
  // 3. User must have manager-level access or higher
  @Put(':projectId')
  @RequirePermissions([{
    permission: 'projects.edit',
    scope: {
      type: 'project',
      dynamicId: 'params.projectId'
    },
    attributes: {
      department: ['HR', 'Management'],
      level: ['manager', 'director', 'admin']
    }
  }])
  async updateProject(
    @Param('projectId') projectId: number,
    @Body() updateData: any,
    @UserAttributes() attributes: any,
    @UserPermissions() permissions: UserPermission[]
  ) {
    return { 
      projectId, 
      updated: updateData,
      userLevel: attributes.level,
      effectivePermissions: permissions.length
    };
  }

  // Multiple permissions (ALL required)
  @Post(':projectId/deploy')
  @RequirePermissions([
    { permission: 'projects.read' },
    { permission: 'projects.deploy' },
    PermissionHelpers.scoped('deployment.execute', 'project', 'projectId')
  ])
  async deployProject(@Param('projectId') projectId: number) {
    return { deployed: projectId };
  }
}
```

### 5. Accessing User Data in Controllers

```typescript
@Controller('profile')
@UseGuards(AuthGuard, PermissionGuard)
export class ProfileController {

  @Get('my-permissions')
  @RequirePermissions([{ permission: 'profile.read' }])
  async getMyPermissions(
    @CurrentUser() user: any,                    // Full user object
    @UserPermissions() permissions: UserPermission[],  // Resolved permissions
    @UserAttributes() attributes: any           // User attributes
  ) {
    return {
      user: { id: user.id, email: user.email },
      permissions: permissions.map(p => ({
        permission: p.permission,
        scope: p.scope,
        source: p.source,
        sourceName: p.sourceName
      })),
      attributes,
      summary: {
        totalPermissions: permissions.length,
        directPermissions: permissions.filter(p => p.source === 'direct').length,
        rolePermissions: permissions.filter(p => p.source === 'role').length,
        groupPermissions: permissions.filter(p => p.source === 'group').length,
        scopedPermissions: permissions.filter(p => p.scope).length,
      }
    };
  }
}
```

## Permission Helper Functions

### PermissionHelpers Class

```typescript
import { PermissionHelpers } from '../decorators/permissions.decorator';

// Dynamic scope from request params
PermissionHelpers.scoped('users.edit', 'company', 'companyId')

// Dynamic scope from request body
PermissionHelpers.scopedFromBody('documents.create', 'company', 'companyId')

// Dynamic scope from query parameters  
PermissionHelpers.scopedFromQuery('reports.read', 'department', 'deptId')

// Attribute-based permission
PermissionHelpers.withAttributes('admin.panel', { role: 'admin' })

// Full permission with scope and attributes
PermissionHelpers.full('projects.delete', 'project', 123, { level: 'admin' })
```

### Quick Permission Decorators

```typescript
// Global permissions
@CanReadUsers()
@CanEditUsers() 
@CanDeleteUsers()
@CanCreateUsers()

// Scoped permissions
@CanReadCompanyUsers()     // Requires companyId param
@CanEditCompanyUsers()     // Requires companyId param
@CanReadProject()          // Requires projectId param
@CanEditProject()          // Requires projectId param

// Attribute-based
@RequireAdmin()            // admin.access + role: 'admin'
@RequireManager()          // management.access + level: ['manager', 'director', 'admin']
```

## Database Examples

### Example Permission Assignments

```sql
-- 1. Global permission directly to user
INSERT INTO permissionsUsersMap (permissionId, userId, referenceableType, referenceableId) 
VALUES (1, 123, NULL, NULL);  -- users.read globally

-- 2. Company-scoped permission to user
INSERT INTO permissionsUsersMap (permissionId, userId, referenceableType, referenceableId)
VALUES (2, 123, 'company', 456);  -- users.edit for company 456

-- 3. Global role assignment
INSERT INTO usersRolesMap (userId, roleId, referenceableType, referenceableId)
VALUES (123, 5, NULL, NULL);  -- Admin role globally

-- 4. Company-scoped role assignment  
INSERT INTO usersRolesMap (userId, roleId, referenceableType, referenceableId)
VALUES (123, 3, 'company', 456);  -- Manager role for company 456

-- 5. Role with scoped permission override
INSERT INTO permissionsRolesMap (permissionId, roleId, referenceableType, referenceableId)
VALUES (10, 3, 'project', 789);  -- projects.deploy only for project 789
```

### User Attributes Examples

```sql
-- Update user with ABAC attributes
UPDATE users 
SET attributes = '{
  "department": "HR",
  "level": "manager", 
  "clearanceLevel": "L3",
  "region": "US",
  "specialAccess": ["payroll", "benefits"]
}'
WHERE id = 123;
```

## Permission Resolution Logic

When checking permissions, the system:

1. **Collects all user permissions** from all sources (direct, roles, groups)
2. **Resolves scopes** using the inheritance rules
3. **Checks for permission match** by name
4. **Validates scope** if required (global permissions match all scopes)
5. **Validates attributes** if required using ABAC rules

### Scope Resolution Priority
1. Permission's own scope (highest priority)
2. Parent role/group scope  
3. Global (null scope) - matches everything

### Permission Evaluation
- **AND logic**: All permissions in `@RequirePermissions([...])` must pass
- **OR logic**: Use `@RequireAnyPermission([...])` for OR logic
- **Scope matching**: Global permissions satisfy scoped requirements
- **Attribute matching**: All specified attributes must match user's attributes

## Best Practices

### 1. Permission Naming
Use hierarchical naming with dots:
```
users.read
users.edit
users.delete
projects.read
projects.edit
projects.deploy
admin.users.impersonate
```

### 2. Scope Types
Use consistent scope type names:
```
company, project, department, region, team
```

### 3. User Attributes
Keep attributes flat and simple:
```json
{
  "department": "HR",
  "level": "manager",
  "region": "US",
  "clearanceLevel": "L3"
}
```

### 4. Role Design
- Create roles that group related permissions
- Use scoped roles for tenant-specific access
- Avoid too many granular roles

### 5. Group Usage
- Use groups for cross-cutting concerns (e.g., "beta-users", "external-contractors")
- Keep group permissions minimal and specific

## Troubleshooting

### Debug Endpoint
Use the debug endpoints in the example controller to inspect permissions:

```typescript
@Get('debug/my-permissions')
@RequirePermissions([{ permission: 'users.read' }])
async debugMyPermissions(
  @UserPermissions() permissions: UserPermission[],
  @UserAttributes() attributes: any
) {
  return { permissions, attributes };
}
```

### Common Issues

1. **403 Forbidden**: Check that user has the exact permission name
2. **Scope mismatch**: Verify scope type and ID match exactly  
3. **Attribute mismatch**: Ensure user attributes contain required values
4. **Multiple guards**: Always use `@UseGuards(AuthGuard, PermissionGuard)` in correct order
5. **Dynamic scope resolution**: Check parameter/body field names match `dynamicId` path

### Permission Resolution Flow
1. AuthGuard authenticates user and loads basic permissions
2. PermissionGuard loads detailed permissions from all sources
3. Each required permission is checked against user's effective permissions
4. Scope and attribute validation is performed
5. Request proceeds or 403 Forbidden is thrown