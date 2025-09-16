import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { parse } from 'yaml';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { 
  permissions, roles, permissionsRolesMap, users, usersGroups, usersGroupsMap, 
  permissionsGroupsMap, usersRolesMap, permissionsUsersMap 
} from '../schema';
import { eq, and, sql } from 'drizzle-orm';
import { existsSync } from 'fs';

const SYSTEM_USER_ID = parseInt(process.env.SYSTEM_USER_ID || '1');

interface PermissionSeed {
  name: string;
  label: string;
  group: string;
  description: string;
}

interface RoleSeed {
  name: string;
  label: string;
  group: string;
  description: string;
  permissions: string[];
}

interface UserGroupSeed {
  name: string;
  description?: string;
  permissions?: string[];
}

interface UserSeed {
  email: string;
  firstName: string;
  lastName: string;
  alias: string;
  attributes?: Record<string, any>;
  roles?: string[];
  groups?: string[];
}

interface SeedConfig {
  permissions?: PermissionSeed[];
  roles?: RoleSeed[];
  userGroups?: UserGroupSeed[];
  users?: UserSeed[];
}

export class DatabaseSeeder {
  private db: any;
  private permissionsConfig: PermissionSeed[];
  private rolesConfig: RoleSeed[];
  private userGroupsConfig: UserGroupSeed[];
  private usersConfig: UserSeed[];
  private permissionAliases: Record<string, string> = {};

  constructor(db: any) {
    this.db = db;
    this.loadConfigurations();
  }

  private loadConfigurations() {
    try {
      this.permissionsConfig = [];
      this.rolesConfig = [];
      this.userGroupsConfig = [];
      this.usersConfig = [];

      // Load all permission files
      const permissionFiles = [
        'permissions.yml',
        'app-permissions.yml', 
        'system-permissions.yml'
      ];

      let totalPermissions = 0;
      for (const file of permissionFiles) {
        const filePath = join(__dirname, '../seeds', file);
        if (existsSync(filePath)) {
          const yaml = readFileSync(filePath, 'utf8');
          const data = parse(yaml) as SeedConfig;
          if (data.permissions) {
            this.permissionsConfig.push(...data.permissions);
            totalPermissions += data.permissions.length;
            console.log(`📁 Loaded ${data.permissions.length} permissions from ${file}`);
          }
        } else {
          console.log(`⚠️  Permission file ${file} not found, skipping...`);
        }
      }

      // Load all role files  
      const roleFiles = [
        'roles.yml',
        'enhanced-roles.yml'
      ];

      let totalRoles = 0;
      for (const file of roleFiles) {
        const filePath = join(__dirname, '../seeds', file);
        if (existsSync(filePath)) {
          const yaml = readFileSync(filePath, 'utf8');
          const data = parse(yaml) as SeedConfig;
          if (data.roles) {
            this.rolesConfig.push(...data.roles);
            totalRoles += data.roles.length;
            console.log(`📁 Loaded ${data.roles.length} roles from ${file}`);
          }
        } else {
          console.log(`⚠️  Role file ${file} not found, skipping...`);
        }
      }

      // Load user groups
      const userGroupsPath = join(__dirname, '../seeds/user-groups.yml');
      if (existsSync(userGroupsPath)) {
        const yaml = readFileSync(userGroupsPath, 'utf8');
        const data = parse(yaml) as SeedConfig;
        if (data.userGroups) {
          this.userGroupsConfig = data.userGroups;
          console.log(`📁 Loaded ${data.userGroups.length} user groups`);
        }
      }

      // Load sample users
      const usersPath = join(__dirname, '../seeds/sample-users.yml');
      if (existsSync(usersPath)) {
        const yaml = readFileSync(usersPath, 'utf8');
        const data = parse(yaml) as SeedConfig;
        if (data.users) {
          this.usersConfig = data.users;
          console.log(`📁 Loaded ${data.users.length} sample users`);
        }
      }

      // Setup backwards compatibility aliases (colon -> dot notation)
      this.setupPermissionAliases();

      console.log(`📊 Total loaded: ${totalPermissions} permissions, ${totalRoles} roles, ${this.userGroupsConfig.length} groups, ${this.usersConfig.length} users`);
    } catch (error) {
      console.error('❌ Failed to load seed configurations:', error);
      throw error;
    }
  }

  private setupPermissionAliases() {
    // Create aliases for backwards compatibility (colon -> dot notation)
    const aliasMap: Record<string, string> = {
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

    this.permissionAliases = aliasMap;
    console.log(`🔄 Set up ${Object.keys(aliasMap).length} permission aliases for backwards compatibility`);
  }

  async ensureSystemUser() {
    console.log('🤖 Ensuring system user exists...');
    
    const existing = await this.db
      .select()
      .from(users)
      .where(eq(users.id, SYSTEM_USER_ID))
      .limit(1);

    if (existing.length === 0) {
      await this.db
        .insert(users)
        .values({
          id: SYSTEM_USER_ID,
          email: process.env.SYSTEM_USER_EMAIL || 'system@template.com',
          alias: process.env.SYSTEM_USER_ALIAS || 'System',
          firstName: process.env.SYSTEM_USER_FIRST_NAME || 'System',
          lastName: process.env.SYSTEM_USER_LAST_NAME || 'User',
          isDeleted: false,
          editedAt: new Date(),
          editedBy: SYSTEM_USER_ID,
          editedSession: null
        });
      
      // Sync the users sequence after inserting system user
      await this.db.execute(sql`SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM users), false);`);
      console.log(`  ✅ Created system user with ID: ${SYSTEM_USER_ID}`);
    } else {
      console.log(`  ✅ System user already exists with ID: ${SYSTEM_USER_ID}`);
    }
  }

  async seedPermissions() {
    console.log('🔑 Seeding permissions...');
    
    for (const permission of this.permissionsConfig) {
      const existing = await this.db
        .select()
        .from(permissions)
        .where(eq(permissions.name, permission.name))
        .limit(1);

      if (existing.length === 0) {
        await this.db
          .insert(permissions)
          .values({
            name: permission.name,
            label: permission.label,
            permissionGroup: permission.group,
            description: permission.description
          });
        console.log(`  ✅ Created permission: ${permission.name}`);
      } else {
        // Update existing permission metadata
        await this.db
          .update(permissions)
          .set({
            label: permission.label,
            permissionGroup: permission.group,
            description: permission.description
          })
          .where(eq(permissions.id, existing[0].id));
        console.log(`  🔄 Updated permission: ${permission.name}`);
      }
    }
  }

  async seedRoles() {
    console.log('👥 Seeding roles...');
    
    for (const role of this.rolesConfig) {
      const existing = await this.db
        .select()
        .from(roles)
        .where(eq(roles.name, role.name))
        .limit(1);

      if (existing.length === 0) {
        await this.db
          .insert(roles)
          .values({
            name: role.name,
            label: role.label,
            roleGroup: role.group,
            description: role.description,
            isDeleted: false,
            editedAt: new Date(),
            editedBy: SYSTEM_USER_ID,
            editedSession: null
          });
        console.log(`  ✅ Created role: ${role.name}`);
      } else {
        // Update existing role metadata
        await this.db
          .update(roles)
          .set({
            label: role.label,
            roleGroup: role.group,
            description: role.description,
            editedAt: new Date(),
            editedBy: SYSTEM_USER_ID
          })
          .where(eq(roles.id, existing[0].id));
        console.log(`  🔄 Updated role: ${role.name}`);
      }
    }
  }

  async seedRolePermissions() {
    console.log('🔗 Seeding role-permission assignments...');
    
    for (const role of this.rolesConfig) {
      const [roleRecord] = await this.db
        .select()
        .from(roles)
        .where(eq(roles.name, role.name))
        .limit(1);

      if (!roleRecord) {
        console.log(`  ⚠️  Role ${role.name} not found, skipping permissions`);
        continue;
      }

      for (const permissionName of role.permissions) {
        const [permission] = await this.db
          .select()
          .from(permissions)
          .where(eq(permissions.name, permissionName))
          .limit(1);

        if (!permission) {
          console.log(`  ⚠️  Permission ${permissionName} not found`);
          continue;
        }

        const existing = await this.db
          .select()
          .from(permissionsRolesMap)
          .where(and(
            eq(permissionsRolesMap.permissionId, permission.id),
            eq(permissionsRolesMap.roleId, roleRecord.id)
          ))
          .limit(1);

        if (existing.length === 0) {
          await this.db
            .insert(permissionsRolesMap)
            .values({
              permissionId: permission.id,
              roleId: roleRecord.id,
              isDeleted: false,
              editedAt: new Date(),
              editedBy: SYSTEM_USER_ID,
              editedSession: null
            });
          console.log(`  ✅ Assigned ${permissionName} to ${role.name}`);
        } else if (existing[0].isDeleted) {
          // Restore deleted permission
          await this.db
            .update(permissionsRolesMap)
            .set({
              isDeleted: false,
              editedAt: new Date(),
              editedBy: SYSTEM_USER_ID
            })
            .where(eq(permissionsRolesMap.permissionId, permission.id));
          console.log(`  🔄 Restored ${permissionName} to ${role.name}`);
        }
      }
    }
  }

  async seedUserGroups() {
    if (this.userGroupsConfig.length === 0) {
      console.log('📋 No user groups to seed, skipping...');
      return;
    }

    console.log('📋 Seeding user groups...');
    
    for (const group of this.userGroupsConfig) {
      const existing = await this.db
        .select()
        .from(usersGroups)
        .where(eq(usersGroups.name, group.name))
        .limit(1);

      if (existing.length === 0) {
        await this.db
          .insert(usersGroups)
          .values({
            name: group.name,
            isDeleted: false,
            editedAt: new Date(),
            editedBy: SYSTEM_USER_ID,
            editedSession: null
          });
        console.log(`  ✅ Created user group: ${group.name}`);
      } else {
        console.log(`  🔄 User group already exists: ${group.name}`);
      }
    }
  }

  async seedUserGroupPermissions() {
    if (this.userGroupsConfig.length === 0) {
      console.log('📋 No user group permissions to seed, skipping...');
      return;
    }

    console.log('🔗 Seeding user group permissions...');
    
    for (const group of this.userGroupsConfig) {
      if (!group.permissions || group.permissions.length === 0) {
        continue;
      }

      const [groupRecord] = await this.db
        .select()
        .from(usersGroups)
        .where(eq(usersGroups.name, group.name))
        .limit(1);

      if (!groupRecord) {
        console.log(`  ⚠️  Group ${group.name} not found, skipping permissions`);
        continue;
      }

      for (const permissionName of group.permissions) {
        const [permission] = await this.db
          .select()
          .from(permissions)
          .where(eq(permissions.name, permissionName))
          .limit(1);

        if (!permission) {
          console.log(`  ⚠️  Permission ${permissionName} not found for group ${group.name}`);
          continue;
        }

        const existing = await this.db
          .select()
          .from(permissionsGroupsMap)
          .where(and(
            eq(permissionsGroupsMap.permissionId, permission.id),
            eq(permissionsGroupsMap.usersGroupId, groupRecord.id)
          ))
          .limit(1);

        if (existing.length === 0) {
          await this.db
            .insert(permissionsGroupsMap)
            .values({
              permissionId: permission.id,
              usersGroupId: groupRecord.id,
              isDeleted: false,
              editedAt: new Date(),
              editedBy: SYSTEM_USER_ID,
              editedSession: null
            });
          console.log(`  ✅ Assigned ${permissionName} to group ${group.name}`);
        }
      }
    }
  }

  async seedSampleUsers() {
    if (this.usersConfig.length === 0) {
      console.log('👤 No sample users to seed, skipping...');
      return;
    }

    console.log('👤 Seeding sample users...');
    
    for (const user of this.usersConfig) {
      const existing = await this.db
        .select()
        .from(users)
        .where(eq(users.email, user.email))
        .limit(1);

      let userId: number;
      
      if (existing.length === 0) {
        const [newUser] = await this.db
          .insert(users)
          .values({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            alias: user.alias,
            attributes: user.attributes || null,
            isDeleted: false,
            editedAt: new Date(),
            editedBy: SYSTEM_USER_ID,
            editedSession: null
          })
          .returning();
        
        userId = newUser.id;
        console.log(`  ✅ Created sample user: ${user.email}`);
      } else {
        // Update existing user with attributes
        await this.db
          .update(users)
          .set({
            firstName: user.firstName,
            lastName: user.lastName,
            alias: user.alias,
            attributes: user.attributes || null,
            editedAt: new Date(),
            editedBy: SYSTEM_USER_ID
          })
          .where(eq(users.id, existing[0].id));
        
        userId = existing[0].id;
        console.log(`  🔄 Updated sample user: ${user.email}`);
      }

      // Assign roles to user
      if (user.roles && user.roles.length > 0) {
        await this.assignRolesToUser(userId, user.roles);
      }

      // Assign groups to user
      if (user.groups && user.groups.length > 0) {
        await this.assignGroupsToUser(userId, user.groups);
      }
    }
  }

  private async assignRolesToUser(userId: number, roleNames: string[]) {
    for (const roleName of roleNames) {
      const [role] = await this.db
        .select()
        .from(roles)
        .where(eq(roles.name, roleName))
        .limit(1);

      if (!role) {
        console.log(`    ⚠️  Role ${roleName} not found`);
        continue;
      }

      const existing = await this.db
        .select()
        .from(usersRolesMap)
        .where(and(
          eq(usersRolesMap.userId, userId),
          eq(usersRolesMap.roleId, role.id)
        ))
        .limit(1);

      if (existing.length === 0) {
        await this.db
          .insert(usersRolesMap)
          .values({
            userId,
            roleId: role.id,
            isDeleted: false,
            editedAt: new Date(),
            editedBy: SYSTEM_USER_ID,
            editedSession: null
          });
        console.log(`    ✅ Assigned role ${roleName} to user`);
      }
    }
  }

  private async assignGroupsToUser(userId: number, groupNames: string[]) {
    for (const groupName of groupNames) {
      const [group] = await this.db
        .select()
        .from(usersGroups)
        .where(eq(usersGroups.name, groupName))
        .limit(1);

      if (!group) {
        console.log(`    ⚠️  Group ${groupName} not found`);
        continue;
      }

      const existing = await this.db
        .select()
        .from(usersGroupsMap)
        .where(and(
          eq(usersGroupsMap.userId, userId),
          eq(usersGroupsMap.usersGroupId, group.id)
        ))
        .limit(1);

      if (existing.length === 0) {
        await this.db
          .insert(usersGroupsMap)
          .values({
            userId,
            usersGroupId: group.id,
            isDeleted: false,
            editedAt: new Date(),
            editedBy: SYSTEM_USER_ID,
            editedSession: null
          });
        console.log(`    ✅ Assigned group ${groupName} to user`);
      }
    }
  }

  async seedAll() {
    console.log('🌱 Starting enhanced database seeding...');
    
    try {
      await this.ensureSystemUser();
      await this.seedPermissions();
      await this.seedRoles();
      await this.seedRolePermissions();
      await this.seedUserGroups();
      await this.seedUserGroupPermissions();
      await this.seedSampleUsers();
      
      console.log('✅ Enhanced database seeding completed successfully!');
    } catch (error) {
      console.error('❌ Database seeding failed:', error);
      throw error;
    }
  }

  // Utility method to validate configurations
  validateConfigurations(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate permissions
    const permissionNames = new Set();
    for (const permission of this.permissionsConfig) {
      if (!permission.name || !permission.label || !permission.group) {
        errors.push(`Permission missing required fields: ${JSON.stringify(permission)}`);
      }
      if (permissionNames.has(permission.name)) {
        errors.push(`Duplicate permission name: ${permission.name}`);
      }
      permissionNames.add(permission.name);
    }

    // Validate roles and their permissions
    const roleNames = new Set();
    for (const role of this.rolesConfig) {
      if (!role.name || !role.label || !role.group) {
        errors.push(`Role missing required fields: ${JSON.stringify(role)}`);
      }
      if (roleNames.has(role.name)) {
        errors.push(`Duplicate role name: ${role.name}`);
      }
      roleNames.add(role.name);

      // Check if all role permissions exist
      for (const permissionName of role.permissions) {
        if (!permissionNames.has(permissionName)) {
          errors.push(`Role ${role.name} references non-existent permission: ${permissionName}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Run if called directly
export async function runSeeder() {
  console.log('🚀 Running database seeder...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  const db = drizzle(pool, { schema: { permissions, roles, permissionsRolesMap, users } });
  const seeder = new DatabaseSeeder(db);

  // Validate configurations first
  const validation = seeder.validateConfigurations();
  if (!validation.valid) {
    console.error('❌ Configuration validation failed:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }

  try {
    await seeder.seedAll();
  } catch (error) {
    console.error('Database seeding failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runSeeder().catch((error) => {
    console.error('Seeder failed:', error);
    process.exit(1);
  });
}