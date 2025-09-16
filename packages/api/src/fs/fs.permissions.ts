// File System Permissions
export const FS_PERMISSIONS = {
  // Read permissions
  FS_READ_NODE: 'fs:read:node',
  FS_LIST_DIRECTORY: 'fs:list:directory', 
  FS_READ_FILE: 'fs:read:file',
  FS_SERVE_FILE: 'fs:serve:file',

  // Write permissions
  FS_CREATE_DIRECTORY: 'fs:create:directory',
  FS_UPLOAD_FILE: 'fs:upload:file',
  FS_WRITE_FILE: 'fs:write:file',

  // Modify permissions
  FS_RENAME_NODE: 'fs:rename:node',
  FS_MOVE_NODE: 'fs:move:node',

  // Delete permissions
  FS_DELETE_FILE: 'fs:delete:file',
  FS_DELETE_DIRECTORY: 'fs:delete:directory',
  FS_DELETE_RECURSIVE: 'fs:delete:recursive',

  // Admin permissions
  FS_ADMIN: 'fs:admin',
} as const;

// Export as array for easy iteration
export const FS_PERMISSION_LIST = Object.values(FS_PERMISSIONS);