import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';

export interface PermissionDefinition {
  name: string;
  label: string;
  group: string;
  description: string;
  module?: string;
}

export interface RoleDefinition {
  name: string;
  label: string;
  group: string;
  description: string;
  permissions: string[];
}

/**
 * Permission Registry - Centralized permission management
 * Loads permissions from YAML files and provides type-safe access
 */
export class PermissionRegistry {
  private static instance: PermissionRegistry;
  private permissions: Map<string, PermissionDefinition> = new Map();
  private roles: Map<string, RoleDefinition> = new Map();
  private permissionsByGroup: Map<string, PermissionDefinition[]> = new Map();

  private constructor() {
    this.loadPermissions();
    this.loadRoles();
    this.indexByGroup();
  }

  static getInstance(): PermissionRegistry {
    if (!PermissionRegistry.instance) {
      PermissionRegistry.instance = new PermissionRegistry();
    }
    return PermissionRegistry.instance;
  }

  private loadPermissions() {
    try {
      const permissionsYaml = readFileSync(
        join(process.cwd(), 'drizzle/seeds/permissions.yml'),
        'utf8'
      );
      const data = parse(permissionsYaml) as { permissions: PermissionDefinition[] };
      
      for (const permission of data.permissions) {
        this.permissions.set(permission.name, permission);
      }
    } catch (error) {
      console.warn('Could not load permissions.yml:', error);
    }
  }

  private loadRoles() {
    try {
      const rolesYaml = readFileSync(
        join(process.cwd(), 'drizzle/seeds/roles.yml'),
        'utf8'
      );
      const data = parse(rolesYaml) as { roles: RoleDefinition[] };
      
      for (const role of data.roles) {
        this.roles.set(role.name, role);
      }
    } catch (error) {
      console.warn('Could not load roles.yml:', error);
    }
  }

  private indexByGroup() {
    for (const permission of this.permissions.values()) {
      const group = permission.group;
      if (!this.permissionsByGroup.has(group)) {
        this.permissionsByGroup.set(group, []);
      }
      this.permissionsByGroup.get(group)!.push(permission);
    }
  }

  // Getters
  getPermission(name: string): PermissionDefinition | undefined {
    return this.permissions.get(name);
  }

  getRole(name: string): RoleDefinition | undefined {
    return this.roles.get(name);
  }

  getAllPermissions(): PermissionDefinition[] {
    return Array.from(this.permissions.values());
  }

  getAllRoles(): RoleDefinition[] {
    return Array.from(this.roles.values());
  }

  getPermissionsByGroup(group: string): PermissionDefinition[] {
    return this.permissionsByGroup.get(group) || [];
  }

  getPermissionGroups(): string[] {
    return Array.from(this.permissionsByGroup.keys());
  }

  // Validation methods
  isValidPermission(name: string): boolean {
    return this.permissions.has(name);
  }

  isValidRole(name: string): boolean {
    return this.roles.has(name);
  }

  validateRolePermissions(roleName: string): { valid: boolean; invalidPermissions: string[] } {
    const role = this.getRole(roleName);
    if (!role) {
      return { valid: false, invalidPermissions: [] };
    }

    const invalidPermissions = role.permissions.filter(p => !this.isValidPermission(p));
    return {
      valid: invalidPermissions.length === 0,
      invalidPermissions
    };
  }

  // Helper methods for common permission patterns
  getPermissionsForModule(module: string): PermissionDefinition[] {
    return this.getAllPermissions().filter(p => p.name.startsWith(`${module}:`));
  }

  getReadPermissions(): PermissionDefinition[] {
    return this.getAllPermissions().filter(p => 
      p.name.includes(':read:') || p.group.includes('read')
    );
  }

  getWritePermissions(): PermissionDefinition[] {
    return this.getAllPermissions().filter(p => 
      p.name.includes(':write:') || p.name.includes(':create:') || p.name.includes(':upload:') || p.group.includes('write')
    );
  }

  getDeletePermissions(): PermissionDefinition[] {
    return this.getAllPermissions().filter(p => 
      p.name.includes(':delete:') || p.group.includes('delete')
    );
  }

  getAdminPermissions(): PermissionDefinition[] {
    return this.getAllPermissions().filter(p => 
      p.name.includes(':admin') || p.group.includes('admin')
    );
  }
}

// Export singleton instance
export const permissionRegistry = PermissionRegistry.getInstance();

// Export type-safe permission constants (generated from YAML)
export const PERMISSIONS = {
  // This could be auto-generated from the YAML file
  FS: {
    READ_NODE: 'fs:read:node',
    LIST_DIRECTORY: 'fs:list:directory',
    READ_FILE: 'fs:read:file',
    SERVE_FILE: 'fs:serve:file',
    CREATE_DIRECTORY: 'fs:create:directory',
    UPLOAD_FILE: 'fs:upload:file',
    WRITE_FILE: 'fs:write:file',
    RENAME_NODE: 'fs:rename:node',
    MOVE_NODE: 'fs:move:node',
    DELETE_FILE: 'fs:delete:file',
    DELETE_DIRECTORY: 'fs:delete:directory',
    DELETE_RECURSIVE: 'fs:delete:recursive',
    ADMIN: 'fs:admin',
  },
  USERS: {
    READ: 'users:read',
    CREATE: 'users:create',
    UPDATE: 'users:update',
    DELETE: 'users:delete',
  },
  SYSTEM: {
    ADMIN: 'system:admin',
  },
  // Application-specific permissions
  INDEXES: {
    // Currency management
    CURRENCIES: {
      CREATE: 'indexes:currencies:create',
      READ: 'indexes:currencies:read',
      UPDATE: 'indexes:currencies:update',
      DELETE: 'indexes:currencies:delete',
    },
    // Relations management
    RELATIONS: {
      CREATE: 'indexes:relations:create',
      READ: 'indexes:relations:read',
      UPDATE: 'indexes:relations:update',
      DELETE: 'indexes:relations:delete',
    },
    // Index values management
    INDEXES: {
      CREATE: 'indexes:indexes:create',
      READ: 'indexes:indexes:read',
      UPDATE: 'indexes:indexes:update',
      DELETE: 'indexes:indexes:delete',
    },
    // Operations
    CONVERT: 'indexes:convert',
    PATH: {
      READ: 'indexes:path:read',
    },
    // Admin
    ADMIN: 'indexes:admin',
  }
} as const;