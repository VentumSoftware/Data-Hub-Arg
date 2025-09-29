import { pgTable, serial, text, timestamp, date, integer, varchar, boolean, real, primaryKey, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { config } from 'dotenv';

config();
const SYSTEM_USER_ID = parseInt(process.env.SYSTEM_USER_ID || '1');

// ------------------------------- ACCESS -------------------------------
export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    email: varchar('email', { length: 254 }).notNull().unique(),

    alias: varchar('alias', { length: 100 }), // Alias
    firstName: varchar('first_name', { length: 50 }), // First name
    lastName: varchar('last_name', { length: 50 }), // Last name

    profilePicture: varchar('profile_picture', { length: 2083 }), // Profile picture URL
    url: varchar('url', { length: 2083 }), // URL to the user's profile (Google, Facebook, GitHub)
    bio: text('bio'), // Bio or description

    birthday: date('birthday'), // Birthday
    gender: varchar('gender', { length: 20 }),
    locale: varchar('locale', { length: 5 }), // Locale
    timezone: varchar('timezone', { length: 255 }), // Format: IANA Timezone Database (e.g., "America/New_York")
    location: varchar('location', { length: 255 }), // Location (e.g., "New York, USA")
    phone: varchar('phone', { length: 50 }), // Phone number
    address: text('address'), // Address (e.g., "123 Main St, New York, NY 10001")
    attributes: jsonb('attributes'), // ABAC attributes (e.g., department, level, clearance)

    isDeleted: boolean('is_deleted').notNull().default(false),
    editedAt: timestamp('edited_at').notNull().defaultNow(),
    editedBy: integer('edited_by').notNull().default(SYSTEM_USER_ID).references(() => users.id, { onDelete: 'cascade' }),
    editedSession: varchar('edited_session', { length: 255 }),
});

export const sessions = pgTable('sessions', {
    id: serial('id').primaryKey(),
    token: varchar('token').notNull().unique(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 50 }).notNull(), // Auth provider (Google, Facebook, GitHub)
    externalId: varchar('external_id', { length: 50 }),
    
    createdAt: timestamp('created_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at'),
    ipAddress: varchar('ip_address', { length: 50 }),
    deviceInfo: varchar('device_info', { length: 50 }),
    geoLocation: varchar('geo_location', { length: 50 }),
    userAgent: varchar('user_agent', { length: 255 }),
    refreshedCount: integer('refreshed_count').notNull().default(0),
    refreshedAt: timestamp('refreshed_at'),

    revokedAt: timestamp('revoked_at'),
    revokedBy: integer('revoked_by').references(() => users.id, { onDelete: 'cascade' }),
});

export const permissions = pgTable('permissions', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull().unique(),
    label: varchar('label', { length: 100 }).notNull().unique(),
    permissionGroup: varchar('permission_group', { length: 100 }),
    description: varchar('description', { length: 255 }),
});

export const roles = pgTable('roles', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull().unique(),
    label: varchar('label', { length: 100 }).notNull().unique(),
    roleGroup: varchar('role_group', { length: 100 }),
    description: varchar('description', { length: 255 }), // Description

    isDeleted: boolean('is_deleted').notNull().default(false),
    editedAt: timestamp('edited_at').notNull().defaultNow(),
    editedBy: integer('edited_by').notNull().default(SYSTEM_USER_ID).references(() => users.id, { onDelete: 'cascade' }),
    editedSession: varchar('edited_session', { length: 255 }),
});

export const permissionsRolesMap = pgTable('permissionsRolesMap', {
    permissionId: integer('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
    roleId: integer('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),

    // Optional scoped permission within role - NULL = inherits role scope or global
    referenceableType: varchar('referenceable_type', { length: 50 }),
    referenceableId: integer('referenceable_id'),

    isDeleted: boolean('is_deleted').notNull().default(false),
    editedAt: timestamp('edited_at').notNull().defaultNow(),
    editedBy: integer('edited_by').notNull().default(SYSTEM_USER_ID).references(() => users.id, { onDelete: 'cascade' }),
    editedSession: varchar('edited_session', { length: 255 }),
}, (table) => {
    return {
        pk: primaryKey({ columns: [table.permissionId, table.roleId] }),
    };
});

export const permissionsUsersMap = pgTable('permissionsUsersMap', {
    permissionId: integer('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

    // Optional scoped permissions - NULL = global permission
    referenceableType: varchar('referenceable_type', { length: 50 }),
    referenceableId: integer('referenceable_id'),

    isDeleted: boolean('is_deleted').notNull().default(false),
    editedAt: timestamp('edited_at').notNull().defaultNow(),
    editedBy: integer('edited_by').notNull().default(SYSTEM_USER_ID).references(() => users.id, { onDelete: 'cascade' }),
    editedSession: varchar('edited_session', { length: 255 }),
}, (table) => {
    return {
        pk: primaryKey({ columns: [table.permissionId, table.userId] }),
    };
});

export const usersRolesMap = pgTable('usersRolesMap', {
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    roleId: integer('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),

    // Optional scoped role assignment - NULL = global role
    referenceableType: varchar('referenceable_type', { length: 50 }),
    referenceableId: integer('referenceable_id'),

    isDeleted: boolean('is_deleted').notNull().default(false),
    editedAt: timestamp('edited_at').notNull().defaultNow(),
    editedBy: integer('edited_by').notNull().default(SYSTEM_USER_ID).references(() => users.id, { onDelete: 'cascade' }),
    editedSession: varchar('edited_session', { length: 255 }),
}, (table) => {
    return {
        pk: primaryKey({ columns: [table.userId, table.roleId] }),
    };
});

export const usersGroups = pgTable('usersGroups', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull().unique(),

    isDeleted: boolean('is_deleted').notNull().default(false),
    editedAt: timestamp('edited_at').notNull().defaultNow(),
    editedBy: integer('edited_by').notNull().default(SYSTEM_USER_ID).references(() => users.id, { onDelete: 'cascade' }),
    editedSession: varchar('edited_session', { length: 255 }),
});

export const usersGroupsMap = pgTable('usersGroupsMap', {
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    usersGroupId: integer('users_group_id').notNull().references(() => usersGroups.id, { onDelete: 'cascade' }),

    isDeleted: boolean('is_deleted').notNull().default(false),
    editedAt: timestamp('edited_at').notNull().defaultNow(),
    editedBy: integer('edited_by').notNull().default(SYSTEM_USER_ID).references(() => users.id, { onDelete: 'cascade' }),
    editedSession: varchar('edited_session', { length: 255 }),
}, (table) => {
    return {
        pk: primaryKey({ columns: [table.userId, table.usersGroupId] }),
    };
});

export const permissionsGroupsMap = pgTable('permissionsGroupsMap', {
    permissionId: integer('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
    usersGroupId: integer('users_group_id').notNull().references(() => usersGroups.id, { onDelete: 'cascade' }),

    // Optional scoped permissions - NULL = global permission
    referenceableType: varchar('referenceable_type', { length: 50 }),
    referenceableId: integer('referenceable_id'),

    isDeleted: boolean('is_deleted').notNull().default(false),
    editedAt: timestamp('edited_at').notNull().defaultNow(),
    editedBy: integer('edited_by').notNull().default(SYSTEM_USER_ID).references(() => users.id, { onDelete: 'cascade' }),
    editedSession: varchar('edited_session', { length: 255 }),
}, (table) => {
    return {
        pk: primaryKey({ columns: [table.permissionId, table.usersGroupId] }),
    };
});

// --------------------------------- CDC-OUTBOX ENUMS ---------------------------------

// Message status for CDC-Outbox pattern  
export const messageStatusEnum = pgEnum('message_status', [
  'pending',    // Message created, not yet published
  'published',  // Message successfully published to queue
  'failed',     // Message publication failed
  'processing', // Message is being processed
  'dead'        // Message moved to dead letter queue after max retries
]);

// Message priority levels
export const messagePriorityEnum = pgEnum('message_priority', [
  'low',
  'normal', 
  'high',
  'critical'
]);

// CDC operation types (extends your existing CDC)
export const cdcOperationEnum = pgEnum('cdc_operation', [
  'INSERT',
  'UPDATE', 
  'DELETE'
]);

// --------------------------------- GENERAL ---------------------------------
export const fsNodeTypeEnum = pgEnum('fs_node_type', ['dir', 'file']);

export const comments = pgTable('comments', {
    id: serial('id').primaryKey(),
    content: text('content').notNull(),
    
    referenceableType: varchar('referenceable_type', { length: 50 }).notNull(),
    referenceableId: integer('referenceable_id').notNull(),
    
    isDeleted: boolean('is_deleted').notNull().default(false),
    editedAt: timestamp('edited_at').notNull().defaultNow(),
    editedBy: integer('edited_by').notNull().default(SYSTEM_USER_ID).references(() => users.id, { onDelete: 'cascade' }),
    editedSession: varchar('edited_session', { length: 255 }),
});

export const fsNodes = pgTable('fsNodes', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    type: fsNodeTypeEnum('type').notNull(),
    path: varchar('path', { length: 500 }).notNull(), // Internal path
    publicPath: varchar('public_path', { length: 500 }), // Public path
    size: integer('size').notNull(), // File size for files and total size for directories

    // For directories only
    childFoldersCount: integer('child_folders_count'),
    childFilesCount: integer('child_files_count'),
    
    // For files only
    originalName: varchar('original_name', { length: 255 }),
    mimeType: varchar('mime_type', { length: 100 }),
    
    // For both
    referenceableType: varchar('referenceable_type', { length: 50 }),
    referenceableId: integer('referenceable_id'),
    
    isDeleted: boolean('is_deleted').notNull().default(false),
    editedAt: timestamp('edited_at').notNull().defaultNow(),
    editedBy: integer('edited_by').notNull().default(SYSTEM_USER_ID).references(() => users.id, { onDelete: 'cascade' }),
    editedSession: varchar('edited_session', { length: 255 }),
});

export const groups = pgTable('groups', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    description: varchar('description', { length: 255 }),
    
    ownerType: varchar('owner_type', { length: 50 }).notNull(),
    ownerId: integer('owner_id').notNull(),
    
    isDeleted: boolean('is_deleted').notNull().default(false),
    editedAt: timestamp('edited_at').notNull().defaultNow(),
    editedBy: integer('edited_by').notNull().default(SYSTEM_USER_ID).references(() => users.id, { onDelete: 'cascade' }),
    editedSession: varchar('edited_session', { length: 255 }),
});

export const groupMemberships = pgTable('groupMemberships', {
    groupId: integer('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
    
    memberType: varchar('member_type', { length: 50 }).notNull(),
    memberId: integer('member_id').notNull(),
    
    isDeleted: boolean('is_deleted').notNull().default(false),
    editedAt: timestamp('edited_at').notNull().defaultNow(),
    editedBy: integer('edited_by').notNull().default(SYSTEM_USER_ID).references(() => users.id, { onDelete: 'cascade' }),
    editedSession: varchar('edited_session', { length: 255 }),
}, (table) => {
    return {
        pk: primaryKey({ columns: [table.groupId, table.memberType, table.memberId] }),
    };
});

// ------------------------------- APP SCHEMA -------------------------------


export const currencies = pgTable('currencies', {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 50 }).notNull().unique(), // e.g., 'peso:arg', 'dolar:usa'
    label: varchar('label', { length: 100 }).notNull(),
    symbol: varchar('symbol', { length: 50 }).notNull(),

    isDeleted: boolean('is_deleted').notNull().default(false),
    editedAt: timestamp('edited_at').notNull().defaultNow(),
    editedBy: integer('edited_by').notNull().default(SYSTEM_USER_ID),
    editedSession: varchar('edited_session', { length: 255 }),
});

export const currencyRelationOpEnum = pgEnum('currency_relation_op', ['direct', 'inverse', 'both']);

export const currenciesRelations = pgTable('currenciesRelations', {
    id: serial('id').primaryKey(),
    dividendId: integer('dividend_id').notNull().references(() => currencies.id, { onDelete: 'cascade' }),
    divisorId: integer('divisor_id').notNull().references(() => currencies.id, { onDelete: 'cascade' }),
    op: currencyRelationOpEnum('op').notNull(),
    source: varchar('source', { length: 2083 }), // URL to get the index

    isDeleted: boolean('is_deleted').notNull().default(false),
    editedAt: timestamp('edited_at').notNull().defaultNow(),
    editedBy: integer('edited_by').notNull().default(SYSTEM_USER_ID),
    editedSession: varchar('edited_session', { length: 255 }),
});

export const currencyIndexes = pgTable('currencyIndexes', {
    id: serial('id').primaryKey(),
    date: date('date').notNull(),
    currenciesRelationsId: integer('currencies_relations_id').notNull().references(() => currenciesRelations.id, { onDelete: 'cascade' }),
    value: real('value').notNull(),

    isDeleted: boolean('is_deleted').notNull().default(false),
    editedAt: timestamp('edited_at').notNull().defaultNow(),
    editedBy: integer('edited_by').notNull().default(SYSTEM_USER_ID),
    editedSession: varchar('edited_session', { length: 255 }),
});


