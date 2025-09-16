import { Injectable, Logger } from '@nestjs/common';
import { sql, eq, and, or, inArray } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { 
  users, 
  permissions, 
  roles, 
  permissionsUsersMap, 
  permissionsRolesMap, 
  usersRolesMap,
  usersGroups,
  usersGroupsMap,
  permissionsGroupsMap
} from '../../../drizzle/schema';

export interface UserPermission {
  id: number;
  name: string;
  label: string;
  group: string;
  description: string;
  source: 'direct' | 'role' | 'group';
  sourceDetails?: {
    roleId?: number;
    roleName?: string;
    groupId?: number;
    groupName?: string;
  };
  scoped?: boolean;
  referenceableType?: string;
  referenceableId?: number;
}

export interface PermissionCheckResult {
  hasPermission: boolean;
  permission?: UserPermission;
  reason?: string;
}

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  private get db() {
    return this.databaseService.db;
  }

  /**
   * Get all permissions for a user, including those from roles and groups
   */
  async getUserPermissions(userId: number, referenceableType?: string, referenceableId?: number): Promise<UserPermission[]> {
    const allPermissions: UserPermission[] = [];

    try {
      // 1. Get direct permissions
      const directPermissions = await this.getDirectUserPermissions(userId, referenceableType, referenceableId);
      allPermissions.push(...directPermissions);

      // 2. Get permissions from roles
      const rolePermissions = await this.getRoleBasedPermissions(userId, referenceableType, referenceableId);
      allPermissions.push(...rolePermissions);

      // 3. Get permissions from groups
      const groupPermissions = await this.getGroupBasedPermissions(userId, referenceableType, referenceableId);
      allPermissions.push(...groupPermissions);

      // Deduplicate permissions by name and scope
      const uniquePermissions = this.deduplicatePermissions(allPermissions);

      this.logger.debug(`Found ${uniquePermissions.length} unique permissions for user ${userId}`);
      return uniquePermissions;
    } catch (error) {
      this.logger.error(`Error getting permissions for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Check if user has a specific permission
   */
  async hasPermission(
    userId: number, 
    permissionName: string, 
    referenceableType?: string, 
    referenceableId?: number
  ): Promise<PermissionCheckResult> {
    try {
      const userPermissions = await this.getUserPermissions(userId, referenceableType, referenceableId);
      
      // Look for exact match first
      let permission = userPermissions.find(p => 
        p.name === permissionName && 
        (!referenceableType || (p.referenceableType === referenceableType && p.referenceableId === referenceableId))
      );

      // If no scoped permission found, check for global permission
      if (!permission && referenceableType) {
        permission = userPermissions.find(p => 
          p.name === permissionName && !p.scoped
        );
      }

      if (permission) {
        return {
          hasPermission: true,
          permission,
          reason: `Permission granted via ${permission.source}`
        };
      }

      return {
        hasPermission: false,
        reason: `Permission '${permissionName}' not found for user`
      };
    } catch (error) {
      this.logger.error(`Error checking permission '${permissionName}' for user ${userId}:`, error);
      return {
        hasPermission: false,
        reason: 'Error checking permission'
      };
    }
  }

  /**
   * Check multiple permissions at once
   */
  async hasPermissions(
    userId: number, 
    permissionNames: string[], 
    referenceableType?: string, 
    referenceableId?: number,
    requireAll: boolean = false
  ): Promise<{ [permissionName: string]: PermissionCheckResult }> {
    const results: { [permissionName: string]: PermissionCheckResult } = {};

    for (const permissionName of permissionNames) {
      results[permissionName] = await this.hasPermission(userId, permissionName, referenceableType, referenceableId);
    }

    return results;
  }

  /**
   * Get all available permissions in the system
   */
  async getAllPermissions(): Promise<any[]> {
    try {
      const allPermissions = await this.db
        .select({
          id: permissions.id,
          name: permissions.name,
          label: permissions.label,
          group: permissions.permissionGroup,
          description: permissions.description
        })
        .from(permissions)
        .orderBy(permissions.permissionGroup, permissions.name);

      return allPermissions;
    } catch (error) {
      this.logger.error('Error getting all permissions:', error);
      throw error;
    }
  }

  /**
   * Assign permission directly to user
   */
  async assignPermissionToUser(
    userId: number,
    permissionName: string,
    assignedBy: number,
    referenceableType?: string,
    referenceableId?: number
  ): Promise<void> {
    try {
      // Get permission ID
      const permission = await this.db
        .select({ id: permissions.id })
        .from(permissions)
        .where(eq(permissions.name, permissionName))
        .limit(1);

      if (!permission || permission.length === 0) {
        throw new Error(`Permission '${permissionName}' not found`);
      }

      // Insert permission assignment (let database handle duplicates)
      await this.db
        .insert(permissionsUsersMap)
        .values({
          userId,
          permissionId: permission[0].id,
          editedBy: assignedBy
        } as any);

      this.logger.log(`Assigned permission '${permissionName}' to user ${userId}`);
    } catch (error) {
      this.logger.error(`Error assigning permission '${permissionName}' to user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Assign role to user
   */
  async assignRoleToUser(
    userId: number,
    roleName: string,
    assignedBy: number,
    referenceableType?: string,
    referenceableId?: number
  ): Promise<void> {
    try {
      // Get role ID
      const role = await this.db
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.name, roleName))
        .limit(1);

      if (!role || role.length === 0) {
        throw new Error(`Role '${roleName}' not found`);
      }

      // Insert role assignment (let database handle duplicates)
      await this.db
        .insert(usersRolesMap)
        .values({
          userId,
          roleId: role[0].id,
          editedBy: assignedBy
        } as any);

      this.logger.log(`Assigned role '${roleName}' to user ${userId}`);
    } catch (error) {
      this.logger.error(`Error assigning role '${roleName}' to user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Remove permission from user
   */
  async removePermissionFromUser(
    userId: number,
    permissionName: string,
    removedBy: number
  ): Promise<void> {
    try {
      // Get permission ID
      const permission = await this.db
        .select({ id: permissions.id })
        .from(permissions)
        .where(eq(permissions.name, permissionName))
        .limit(1);

      if (!permission || permission.length === 0) {
        throw new Error(`Permission '${permissionName}' not found`);
      }

      // Mark permission assignment as deleted
      await this.db
        .update(permissionsUsersMap)
        .set({
          editedBy: removedBy
        } as any)
        .where(and(
          eq(permissionsUsersMap.userId, userId),
          eq(permissionsUsersMap.permissionId, permission[0].id)
        ));

      this.logger.log(`Removed permission '${permissionName}' from user ${userId}`);
    } catch (error) {
      this.logger.error(`Error removing permission '${permissionName}' from user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Remove role from user
   */
  async removeRoleFromUser(
    userId: number,
    roleName: string,
    removedBy: number
  ): Promise<void> {
    try {
      // Get role ID
      const role = await this.db
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.name, roleName))
        .limit(1);

      if (!role || role.length === 0) {
        throw new Error(`Role '${roleName}' not found`);
      }

      // Mark role assignment as deleted  
      await this.db
        .update(usersRolesMap)
        .set({
          editedBy: removedBy
        } as any)
        .where(and(
          eq(usersRolesMap.userId, userId),
          eq(usersRolesMap.roleId, role[0].id)
        ));

      this.logger.log(`Removed role '${roleName}' from user ${userId}`);
    } catch (error) {
      this.logger.error(`Error removing role '${roleName}' from user ${userId}:`, error);
      throw error;
    }
  }

  // Private helper methods

  private async getDirectUserPermissions(userId: number, referenceableType?: string, referenceableId?: number): Promise<UserPermission[]> {
    const query = this.db
      .select({
        id: permissions.id,
        name: permissions.name,
        label: permissions.label,
        group: permissions.permissionGroup,
        description: permissions.description,
        referenceableType: permissionsUsersMap.referenceableType,
        referenceableId: permissionsUsersMap.referenceableId
      })
      .from(permissionsUsersMap)
      .innerJoin(permissions, eq(permissionsUsersMap.permissionId, permissions.id))
      .where(and(
        eq(permissionsUsersMap.userId, userId),
        eq(permissionsUsersMap.isDeleted, false),
        referenceableType 
          ? or(
              and(
                eq(permissionsUsersMap.referenceableType, referenceableType),
                eq(permissionsUsersMap.referenceableId, referenceableId || 0)
              ),
              sql`${permissionsUsersMap.referenceableType} IS NULL`
            )
          : sql`1=1`
      ));

    const results = await query;

    return results.map(p => ({
      id: p.id,
      name: p.name,
      label: p.label,
      group: p.group,
      description: p.description,
      source: 'direct' as const,
      scoped: !!p.referenceableType,
      referenceableType: p.referenceableType,
      referenceableId: p.referenceableId
    }));
  }

  private async getRoleBasedPermissions(userId: number, referenceableType?: string, referenceableId?: number): Promise<UserPermission[]> {
    const query = this.db
      .select({
        id: permissions.id,
        name: permissions.name,
        label: permissions.label,
        group: permissions.permissionGroup,
        description: permissions.description,
        roleId: roles.id,
        roleName: roles.name,
        referenceableType: permissionsRolesMap.referenceableType,
        referenceableId: permissionsRolesMap.referenceableId
      })
      .from(usersRolesMap)
      .innerJoin(roles, eq(usersRolesMap.roleId, roles.id))
      .innerJoin(permissionsRolesMap, eq(roles.id, permissionsRolesMap.roleId))
      .innerJoin(permissions, eq(permissionsRolesMap.permissionId, permissions.id))
      .where(and(
        eq(usersRolesMap.userId, userId),
        eq(usersRolesMap.isDeleted, false),
        eq(roles.isDeleted, false),
        eq(permissionsRolesMap.isDeleted, false),
        referenceableType 
          ? or(
              and(
                eq(permissionsRolesMap.referenceableType, referenceableType),
                eq(permissionsRolesMap.referenceableId, referenceableId || 0)
              ),
              eq(permissionsRolesMap.referenceableType, '')
            )
          : sql`1=1`
      ));

    const results = await query;

    return results.map(p => ({
      id: p.id,
      name: p.name,
      label: p.label,
      group: p.group,
      description: p.description,
      source: 'role' as const,
      sourceDetails: {
        roleId: p.roleId,
        roleName: p.roleName
      },
      scoped: !!p.referenceableType && p.referenceableType !== '',
      referenceableType: p.referenceableType || undefined,
      referenceableId: p.referenceableId || undefined
    }));
  }

  private async getGroupBasedPermissions(userId: number, referenceableType?: string, referenceableId?: number): Promise<UserPermission[]> {
    const query = this.db
      .select({
        id: permissions.id,
        name: permissions.name,
        label: permissions.label,
        group: permissions.permissionGroup,
        description: permissions.description,
        groupId: usersGroups.id,
        groupName: usersGroups.name,
        referenceableType: permissionsGroupsMap.referenceableType,
        referenceableId: permissionsGroupsMap.referenceableId
      })
      .from(usersGroupsMap)
      .innerJoin(usersGroups, eq(usersGroupsMap.usersGroupId, usersGroups.id))
      .innerJoin(permissionsGroupsMap, eq(usersGroups.id, permissionsGroupsMap.usersGroupId))
      .innerJoin(permissions, eq(permissionsGroupsMap.permissionId, permissions.id))
      .where(and(
        eq(usersGroupsMap.userId, userId),
        eq(usersGroupsMap.isDeleted, false),
        eq(usersGroups.isDeleted, false),
        eq(permissionsGroupsMap.isDeleted, false),
        referenceableType 
          ? or(
              and(
                eq(permissionsGroupsMap.referenceableType, referenceableType),
                eq(permissionsGroupsMap.referenceableId, referenceableId || 0)
              ),
              sql`${permissionsGroupsMap.referenceableType} IS NULL`
            )
          : sql`1=1`
      ));

    const results = await query;

    return results.map(p => ({
      id: p.id,
      name: p.name,
      label: p.label,
      group: p.group,
      description: p.description,
      source: 'group' as const,
      sourceDetails: {
        groupId: p.groupId,
        groupName: p.groupName
      },
      scoped: !!p.referenceableType,
      referenceableType: p.referenceableType,
      referenceableId: p.referenceableId
    }));
  }

  private deduplicatePermissions(permissions: UserPermission[]): UserPermission[] {
    const unique = new Map<string, UserPermission>();

    for (const permission of permissions) {
      const key = `${permission.name}_${permission.referenceableType || 'global'}_${permission.referenceableId || 0}`;
      
      // Keep the permission with higher priority source (direct > role > group)
      const existing = unique.get(key);
      if (!existing || this.getSourcePriority(permission.source) > this.getSourcePriority(existing.source)) {
        unique.set(key, permission);
      }
    }

    return Array.from(unique.values());
  }

  private getSourcePriority(source: 'direct' | 'role' | 'group'): number {
    switch (source) {
      case 'direct': return 3;
      case 'role': return 2;
      case 'group': return 1;
      default: return 0;
    }
  }
}