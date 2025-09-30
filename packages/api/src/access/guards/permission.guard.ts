// src/access/guards/permission.guard.ts
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../../database/database.service';
import { eq, and, inArray, or, isNull } from 'drizzle-orm';

export interface PermissionCheck {
  permission: string;
  scope?: {
    type: string;
    id?: number | string;
    // Support for dynamic scope resolution from request
    dynamicId?: string; // e.g., 'params.companyId', 'body.projectId'
  };
  // ABAC attribute conditions
  attributes?: Record<string, any>;
}

export interface UserPermission {
  permission: string;
  scope?: {
    type: string;
    id: number;
  };
  source: 'direct' | 'role' | 'group';
  sourceId: number;
  sourceName: string;
}

@Injectable()
export class PermissionGuard implements CanActivate {
  private db;
  private users;
  private permissions;
  private roles;
  private usersGroups;
  private permissionsUsersMap;
  private usersRolesMap;
  private permissionsRolesMap;
  private usersGroupsMap;
  private permissionsGroupsMap;
  
  // Backwards compatibility mapping (colon -> dot notation)
  private permissionAliases: Record<string, string> = {
    // File system
    'fs:read:node': 'fs.read.node',
    'fs:list:directory': 'fs.list.directory',
    'fs:read:file': 'fs.read.file',
    'fs:serve:file': 'fs.serve.file',
    'fs:create:directory': 'fs.create.directory',
    'fs:upload:file': 'fs.upload.file',
    'fs:write:file': 'fs.write.file',
    'fs:rename:node': 'fs.rename.node',
    'fs:move:node': 'fs.move.node',
    'fs:delete:file': 'fs.delete.file',
    'fs:delete:directory': 'fs.delete.directory',
    'fs:delete:recursive': 'fs.delete.recursive',
    'fs:admin': 'fs.admin',
    
    // Users
    'users:read': 'users.read',
    'users:create': 'users.create',
    'users:update': 'users.edit',
    'users:delete': 'users.delete',
    'users:activity:read': 'users.activity.read',
    'users:history:read': 'users.history.read',
    
    // System
    'system:admin': 'admin.access'
  };

  constructor(
    private reflector: Reflector,
    private databaseService: DatabaseService
  ) {
    this.db = this.databaseService.db;
    const { 
      users, permissions, roles, usersGroups, 
      permissionsUsersMap, usersRolesMap, permissionsRolesMap,
      usersGroupsMap, permissionsGroupsMap 
    } = this.databaseService.schema;
    
    this.users = users;
    this.permissions = permissions;
    this.roles = roles;
    this.usersGroups = usersGroups;
    this.permissionsUsersMap = permissionsUsersMap;
    this.usersRolesMap = usersRolesMap;
    this.permissionsRolesMap = permissionsRolesMap;
    this.usersGroupsMap = usersGroupsMap;
    this.permissionsGroupsMap = permissionsGroupsMap;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<PermissionCheck[]>('permissions', context.getHandler());
    
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // No permissions required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const userAttributes = user?.attributes || {};

    if (!user) {
      throw new ForbiddenException({
        success: false,
        message: 'Authentication required',
        error: 'NO_USER'
      });
    }

    try {
      // Get all user permissions from all sources
      const userPermissions = await this.getAllUserPermissions(user.id);
      
      // Check each required permission
      for (const requiredPermission of requiredPermissions) {
        // Normalize permission name for backwards compatibility
        const normalizedPermission = {
          ...requiredPermission,
          permission: this.normalizePermissionName(requiredPermission.permission)
        };

        const hasPermission = await this.checkPermission(
          normalizedPermission,
          userPermissions,
          userAttributes,
          request
        );

        if (!hasPermission) {
          throw new ForbiddenException({
            success: false,
            message: `Access denied: Missing permission '${requiredPermission.permission}'`,
            error: 'INSUFFICIENT_PERMISSIONS',
            required: requiredPermission,
            userPermissions: userPermissions.map(p => ({
              permission: p.permission,
              scope: p.scope,
              source: p.source
            }))
          });
        }
      }

      // Attach resolved permissions to request for controllers to use
      request.userPermissions = userPermissions;
      request.userAttributes = userAttributes;

      return true;

    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      
      console.error('Permission check error:', error);
      throw new ForbiddenException({
        success: false,
        message: 'Permission check failed',
        error: 'PERMISSION_ERROR'
      });
    }
  }

  /**
   * Normalize permission name for backwards compatibility
   */
  private normalizePermissionName(permission: string): string {
    return this.permissionAliases[permission] || permission;
  }

  /**
   * Get all permissions for a user from all sources (direct, roles, groups)
   */
  private async getAllUserPermissions(userId: number): Promise<UserPermission[]> {
    const allPermissions: UserPermission[] = [];

    // 1. Direct user permissions
    const directPermissions = await this.db
      .select({
        permission: this.permissions.name,
        referenceableType: this.permissionsUsersMap.referenceableType,
        referenceableId: this.permissionsUsersMap.referenceableId,
      })
      .from(this.permissionsUsersMap)
      .innerJoin(this.permissions, eq(this.permissionsUsersMap.permissionId, this.permissions.id))
      .where(
        and(
          eq(this.permissionsUsersMap.userId, userId),
          eq(this.permissionsUsersMap.isDeleted, false)
        )
      );

    directPermissions.forEach(p => {
      allPermissions.push({
        permission: p.permission,
        scope: p.referenceableType && p.referenceableId 
          ? { type: p.referenceableType, id: p.referenceableId }
          : undefined,
        source: 'direct',
        sourceId: userId,
        sourceName: 'User'
      });
    });

    // 2. Role-based permissions
    const rolePermissions = await this.db
      .select({
        permission: this.permissions.name,
        // Permission scope from permissionsRolesMap
        permissionScope: this.permissionsRolesMap.referenceableType,
        permissionScopeId: this.permissionsRolesMap.referenceableId,
        // Role scope from usersRolesMap
        roleScope: this.usersRolesMap.referenceableType,
        roleScopeId: this.usersRolesMap.referenceableId,
        roleId: this.roles.id,
        roleName: this.roles.name,
      })
      .from(this.usersRolesMap)
      .innerJoin(this.roles, eq(this.usersRolesMap.roleId, this.roles.id))
      .innerJoin(this.permissionsRolesMap, eq(this.roles.id, this.permissionsRolesMap.roleId))
      .innerJoin(this.permissions, eq(this.permissionsRolesMap.permissionId, this.permissions.id))
      .where(
        and(
          eq(this.usersRolesMap.userId, userId),
          eq(this.usersRolesMap.isDeleted, false),
          eq(this.permissionsRolesMap.isDeleted, false),
          eq(this.roles.isDeleted, false)
        )
      );

    rolePermissions.forEach(p => {
      // Determine effective scope: permission scope > role scope > global
      let effectiveScope: { type: string; id: number } | undefined;
      
      if (p.permissionScope && p.permissionScopeId) {
        // Permission has its own scope
        effectiveScope = { type: p.permissionScope, id: p.permissionScopeId };
      } else if (p.roleScope && p.roleScopeId) {
        // Inherit from role scope
        effectiveScope = { type: p.roleScope, id: p.roleScopeId };
      }
      // Otherwise, it's global (undefined scope)

      allPermissions.push({
        permission: p.permission,
        scope: effectiveScope,
        source: 'role',
        sourceId: p.roleId,
        sourceName: p.roleName
      });
    });

    // 3. Group-based permissions
    const groupPermissions = await this.db
      .select({
        permission: this.permissions.name,
        referenceableType: this.permissionsGroupsMap.referenceableType,
        referenceableId: this.permissionsGroupsMap.referenceableId,
        groupId: this.usersGroups.id,
        groupName: this.usersGroups.name,
      })
      .from(this.usersGroupsMap)
      .innerJoin(this.usersGroups, eq(this.usersGroupsMap.usersGroupId, this.usersGroups.id))
      .innerJoin(this.permissionsGroupsMap, eq(this.usersGroups.id, this.permissionsGroupsMap.usersGroupId))
      .innerJoin(this.permissions, eq(this.permissionsGroupsMap.permissionId, this.permissions.id))
      .where(
        and(
          eq(this.usersGroupsMap.userId, userId),
          eq(this.usersGroupsMap.isDeleted, false),
          eq(this.permissionsGroupsMap.isDeleted, false),
          eq(this.usersGroups.isDeleted, false)
        )
      );

    groupPermissions.forEach(p => {
      allPermissions.push({
        permission: p.permission,
        scope: p.referenceableType && p.referenceableId 
          ? { type: p.referenceableType, id: p.referenceableId }
          : undefined,
        source: 'group',
        sourceId: p.groupId,
        sourceName: p.groupName
      });
    });

    return allPermissions;
  }

  /**
   * Check if user has a specific permission with optional scope and attribute matching
   */
  private async checkPermission(
    required: PermissionCheck,
    userPermissions: UserPermission[],
    userAttributes: Record<string, any>,
    request: any
  ): Promise<boolean> {
    // Find matching permissions by name
    const matchingPermissions = userPermissions.filter(p => p.permission === required.permission);
    
    if (matchingPermissions.length === 0) {
      return false; // User doesn't have this permission at all
    }

    // If no scope required, and user has the permission (scoped or global), allow
    if (!required.scope) {
      return true;
    }

    // Resolve dynamic scope ID from request
    const resolvedScopeId = this.resolveDynamicScopeId(required.scope, request);

    // Check if user has permission with matching scope
    const hasMatchingScope = matchingPermissions.some(p => {
      if (!p.scope) {
        // User has global permission, which covers all scopes
        return true;
      }
      
      // Check exact scope match
      return p.scope.type === required.scope.type && 
             (!resolvedScopeId || p.scope.id === resolvedScopeId);
    });

    if (!hasMatchingScope) {
      return false;
    }

    // Check ABAC attributes if required
    if (required.attributes) {
      return this.checkAttributes(required.attributes, userAttributes);
    }

    return true;
  }

  /**
   * Resolve dynamic scope ID from request (e.g., params.companyId)
   */
  private resolveDynamicScopeId(scope: PermissionCheck['scope'], request: any): number | undefined {
    if (!scope?.dynamicId) {
      return typeof scope?.id === 'string' ? parseInt(scope.id) : scope?.id;
    }

    const parts = scope.dynamicId.split('.');
    let value = request;
    
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) break;
    }

    return value ? parseInt(value) : undefined;
  }

  /**
   * Check ABAC attributes
   */
  private checkAttributes(required: Record<string, any>, userAttributes: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(required)) {
      if (Array.isArray(value)) {
        // Check if user attribute is in allowed array
        if (!value.includes(userAttributes[key])) {
          return false;
        }
      } else {
        // Exact match
        if (userAttributes[key] !== value) {
          return false;
        }
      }
    }
    return true;
  }
}