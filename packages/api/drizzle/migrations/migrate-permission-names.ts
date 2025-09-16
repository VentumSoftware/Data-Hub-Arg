import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { permissions } from '../schema';
import { eq } from 'drizzle-orm';
import { config } from 'dotenv';

config();

/**
 * Migration: Update permission names from colon to dot notation
 * This migration provides backwards compatibility while modernizing naming
 */

interface PermissionMapping {
  old: string;
  new: string;
}

const permissionMappings: PermissionMapping[] = [
  // File System permissions
  { old: 'fs:read:node', new: 'fs.read.node' },
  { old: 'fs:list:directory', new: 'fs.list.directory' },
  { old: 'fs:read:file', new: 'fs.read.file' },
  { old: 'fs:serve:file', new: 'fs.serve.file' },
  { old: 'fs:create:directory', new: 'fs.create.directory' },
  { old: 'fs:upload:file', new: 'fs.upload.file' },
  { old: 'fs:write:file', new: 'fs.write.file' },
  { old: 'fs:rename:node', new: 'fs.rename.node' },
  { old: 'fs:move:node', new: 'fs.move.node' },
  { old: 'fs:delete:file', new: 'fs.delete.file' },
  { old: 'fs:delete:directory', new: 'fs.delete.directory' },
  { old: 'fs:delete:recursive', new: 'fs.delete.recursive' },
  { old: 'fs:admin', new: 'fs.admin' },

  // User Management permissions (also standardize update->edit)
  { old: 'users:read', new: 'users.read' },
  { old: 'users:create', new: 'users.create' },
  { old: 'users:update', new: 'users.edit' },
  { old: 'users:delete', new: 'users.delete' },
  { old: 'users:activity:read', new: 'users.activity.read' },
  { old: 'users:history:read', new: 'users.history.read' },

  // Company permissions
  { old: 'companies:create', new: 'companies.create' },
  { old: 'companies:read', new: 'companies.read' },
  { old: 'companies:update', new: 'companies.edit' },
  { old: 'companies:delete', new: 'companies.delete' },

  // Project permissions
  { old: 'projects:create', new: 'projects.create' },
  { old: 'projects:read', new: 'projects.read' },
  { old: 'projects:update', new: 'projects.edit' },
  { old: 'projects:delete', new: 'projects.delete' },

  // Unit permissions
  { old: 'units:create', new: 'units.create' },
  { old: 'units:read', new: 'units.read' },
  { old: 'units:update', new: 'units.edit' },
  { old: 'units:delete', new: 'units.delete' },

  // Ownership permissions
  { old: 'ownership:create', new: 'ownership.create' },
  { old: 'ownership:read', new: 'ownership.read' },
  { old: 'ownership:update', new: 'ownership.edit' },
  { old: 'ownership:delete', new: 'ownership.delete' },

  // Payment permissions
  { old: 'payments:create', new: 'payments.create' },
  { old: 'payments:read', new: 'payments.read' },
  { old: 'payments:update', new: 'payments.edit' },
  { old: 'payments:delete', new: 'payments.delete' },

  // Comment permissions
  { old: 'comments:create', new: 'comments.create' },
  { old: 'comments:read', new: 'comments.read' },
  { old: 'comments:update', new: 'comments.edit' },
  { old: 'comments:delete', new: 'comments.delete' },
  { old: 'comments:moderate', new: 'comments.moderate' },

  // Group permissions
  { old: 'groups:create', new: 'groups.create' },
  { old: 'groups:read', new: 'groups.read' },
  { old: 'groups:update', new: 'groups.edit' },
  { old: 'groups:delete', new: 'groups.delete' },

  // User Groups permissions
  { old: 'user-groups:create', new: 'user-groups.create' },
  { old: 'user-groups:read', new: 'user-groups.read' },
  { old: 'user-groups:update', new: 'user-groups.edit' },
  { old: 'user-groups:delete', new: 'user-groups.delete' },
  { old: 'user-groups:manage-members', new: 'user-groups.manage-members' },

  // Access Control permissions
  { old: 'permissions:read', new: 'permissions.read' },
  { old: 'roles:create', new: 'roles.create' },
  { old: 'roles:read', new: 'roles.read' },
  { old: 'roles:update', new: 'roles.edit' },
  { old: 'roles:delete', new: 'roles.delete' },
  { old: 'access:assign-permissions', new: 'access.assign-permissions' },
  { old: 'access:assign-roles', new: 'access.assign-roles' },

  // Session permissions
  { old: 'sessions:read', new: 'sessions.read' },
  { old: 'sessions:revoke', new: 'sessions.revoke' },
  { old: 'sessions:admin', new: 'sessions.admin' },

  // Index/Currency permissions
  { old: 'indexes:currencies:create', new: 'indexes.currencies.create' },
  { old: 'indexes:currencies:read', new: 'indexes.currencies.read' },
  { old: 'indexes:currencies:update', new: 'indexes.currencies.edit' },
  { old: 'indexes:currencies:delete', new: 'indexes.currencies.delete' },
  { old: 'indexes:relations:create', new: 'indexes.relations.create' },
  { old: 'indexes:relations:read', new: 'indexes.relations.read' },
  { old: 'indexes:relations:update', new: 'indexes.relations.edit' },
  { old: 'indexes:relations:delete', new: 'indexes.relations.delete' },
  { old: 'indexes:indexes:create', new: 'indexes.indexes.create' },
  { old: 'indexes:indexes:read', new: 'indexes.indexes.read' },
  { old: 'indexes:indexes:update', new: 'indexes.indexes.edit' },
  { old: 'indexes:indexes:delete', new: 'indexes.indexes.delete' },
  { old: 'indexes:convert', new: 'indexes.convert' },
  { old: 'indexes:path:read', new: 'indexes.path.read' },
  { old: 'indexes:admin', new: 'indexes.admin' },

  // Mailing permissions
  { old: 'mailing:create', new: 'mailing.create' },
  { old: 'mailing:read', new: 'mailing.read' },
  { old: 'mailing:templates:manage', new: 'mailing.templates.manage' },
  { old: 'mailing:admin', new: 'mailing.admin' },

  // System permission
  { old: 'system:admin', new: 'admin.access' },
];

export async function migratePermissionNames() {
  console.log('🔄 Starting permission names migration...');
  
  // Database connection configuration
  let dbConfig;
  
  if (process.env.DATABASE_URL) {
    dbConfig = { connectionString: process.env.DATABASE_URL };
  } else {
    const useSSL = (process.env.POSTGRES_SSL || process.env.DDBB_CONNECTION_SSL) === 'true';
    
    dbConfig = {
      host: process.env.POSTGRES_HOST || process.env.DDBB_CONNECTION_HOST || 'postgres',
      port: parseInt(process.env.POSTGRES_PORT || process.env.DDBB_CONNECTION_PORT || '5432'),
      database: process.env.POSTGRES_DB || process.env.DDBB_CONNECTION_DATABASE || 'app_local',
      user: process.env.POSTGRES_USER || process.env.DDBB_CONNECTION_USER || 'app_user',
      password: process.env.POSTGRES_PASSWORD || process.env.DDBB_CONNECTION_PASSWORD || 'app_password',
      ssl: useSSL ? { rejectUnauthorized: false } : false
    };
  }
  
  const pool = new Pool(dbConfig);
  const db = drizzle(pool, { schema: { permissions } });

  let successCount = 0;
  let skippedCount = 0;

  try {
    for (const mapping of permissionMappings) {
      // Check if old permission exists
      const [existingPermission] = await db
        .select()
        .from(permissions)
        .where(eq(permissions.name, mapping.old))
        .limit(1);

      if (existingPermission) {
        // Check if new permission name already exists (avoid conflicts)
        const [conflictingPermission] = await db
          .select()
          .from(permissions)
          .where(eq(permissions.name, mapping.new))
          .limit(1);

        if (conflictingPermission) {
          console.log(`  ⚠️  Conflict: ${mapping.new} already exists, skipping migration of ${mapping.old}`);
          skippedCount++;
          continue;
        }

        // Update the permission name
        await db
          .update(permissions)
          .set({ name: mapping.new })
          .where(eq(permissions.id, existingPermission.id));

        console.log(`  ✅ Updated: ${mapping.old} → ${mapping.new}`);
        successCount++;
      } else {
        console.log(`  ⏭️  Permission ${mapping.old} not found, skipping`);
        skippedCount++;
      }
    }

    console.log(`✅ Migration completed: ${successCount} updated, ${skippedCount} skipped`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Rollback function (in case migration needs to be reverted)
export async function rollbackPermissionNames() {
  console.log('🔄 Starting permission names rollback...');
  
  // Database connection (same logic as above)
  let dbConfig;
  
  if (process.env.DATABASE_URL) {
    dbConfig = { connectionString: process.env.DATABASE_URL };
  } else {
    const useSSL = (process.env.POSTGRES_SSL || process.env.DDBB_CONNECTION_SSL) === 'true';
    
    dbConfig = {
      host: process.env.POSTGRES_HOST || process.env.DDBB_CONNECTION_HOST || 'postgres',
      port: parseInt(process.env.POSTGRES_PORT || process.env.DDBB_CONNECTION_PORT || '5432'),
      database: process.env.POSTGRES_DB || process.env.DDBB_CONNECTION_DATABASE || 'app_local',
      user: process.env.POSTGRES_USER || process.env.DDBB_CONNECTION_USER || 'app_user',
      password: process.env.POSTGRES_PASSWORD || process.env.DDBB_CONNECTION_PASSWORD || 'app_password',
      ssl: useSSL ? { rejectUnauthorized: false } : false
    };
  }
  
  const pool = new Pool(dbConfig);
  const db = drizzle(pool, { schema: { permissions } });

  let rollbackCount = 0;

  try {
    // Reverse the mappings for rollback
    for (const mapping of permissionMappings) {
      const [existingPermission] = await db
        .select()
        .from(permissions)
        .where(eq(permissions.name, mapping.new))
        .limit(1);

      if (existingPermission) {
        await db
          .update(permissions)
          .set({ name: mapping.old })
          .where(eq(permissions.id, existingPermission.id));

        console.log(`  ✅ Rolled back: ${mapping.new} → ${mapping.old}`);
        rollbackCount++;
      }
    }

    console.log(`✅ Rollback completed: ${rollbackCount} permissions restored`);
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'rollback') {
    rollbackPermissionNames().catch((error) => {
      console.error('Rollback failed:', error);
      process.exit(1);
    });
  } else {
    migratePermissionNames().catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
  }
}