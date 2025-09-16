# SFTP Server Configuration

This directory contains configuration files for the SFTP server.

## Files

- `users.conf` - User configuration file
- `host_keys/` - SSH host keys (generated automatically)

## User Configuration

The `users.conf` file defines SFTP users with the format:
```
username:password:uid:gid:directories
```

### Current Users

- **proyectia_user** - Main application user
  - Password: `proyectia_sftp_password`
  - UID/GID: 1001/1001
  - Home directory: `/home/proyectia_user/upload`

## Security Notes

- Change default passwords in production
- Consider using SSH keys instead of passwords
- The SFTP server is accessible on port 2222
- Users are chrooted to their home directories

## Directory Structure

```
/home/proyectia_user/
└── upload/          # Main upload directory
    ├── projects/    # Project files
    ├── documents/   # Document storage
    └── temp/        # Temporary files
```