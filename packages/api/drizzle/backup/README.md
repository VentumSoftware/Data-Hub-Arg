# CDC Table Backup System

This backup system automatically creates backups of CDC (Change Data Capture) tables before migrations that might delete them.

## Features

- **Automatic Detection**: Identifies CDC tables based on configurable prefix
- **Session-based Backups**: Each backup creates a unique timestamped folder
- **Configurable Location**: Backup location configurable via YAML
- **Backup Summary**: Creates summary file with backup metadata
- **Integration**: Seamlessly integrates with Drizzle migration workflow

## Backup Location

Backups are stored at the **project root**:
```
/local/backups/drizzle/cdc/
└── backup_2025-07-20T12-26-55-178Z/
    ├── backup-summary.txt
    ├── _cdc_permissions.sql
    ├── _cdc_roles.sql
    └── _cdc_users.sql
```

## Usage

### Manual Backup
```bash
npm run migration:backup
```

### Safe Migration (with automatic backup)
```bash
npm run migration:push-safe    # Push with backup
npm run migration:full-safe    # Full migration with backup
```

### Custom Backup Path
```bash
npm run migration:backup /custom/path/to/backups
```

## Configuration

Configuration is in `/drizzle/config/backup.yml`:

```yaml
backup:
  enabled: true
  path: "../../../../local/backups/drizzle/cdc"  # Project root
  format: "sql"
  compress: false
  retention_days: 30
```

## Backup Process

1. **Detection**: Scans database for CDC tables using configured prefix
2. **Verification**: Checks row counts and skips empty tables
3. **Session Creation**: Creates unique backup folder with timestamp
4. **Data Export**: Uses `pg_dump` to export table data as SQL INSERT statements
5. **Summary**: Creates backup summary with metadata
6. **Verification**: Reports backup completion with file locations

## Integration with Migrations

The backup system integrates with Drizzle migrations:

- **Before Migration**: Automatically detects CDC tables that would be lost
- **User Choice**: Prompts to create backup (can be made automatic)
- **Safe Execution**: Only proceeds with migration after successful backup
- **Recovery**: Provides clear file locations for data recovery

## Recovery

To restore from backup:

1. Locate backup folder in `/local/backups/drizzle/cdc/`
2. Check `backup-summary.txt` for overview
3. Run SQL files against database:
   ```bash
   psql -U username -d database -f _cdc_tablename.sql
   ```

## Advanced Usage

### Pre-migration Script
```bash
npm run migration:pre  # Checks and backs up before migration
```

### Custom Backup Integration
```typescript
import CDCBackup from './drizzle/backup/cdc-backup';

const backup = new CDCBackup('/custom/path');
const backupFiles = await backup.runBackup(false); // Non-interactive
```

## Error Handling

- **Missing Tables**: Skips non-existent tables gracefully
- **Empty Tables**: Skips backup but logs the action
- **Permission Errors**: Reports clear error messages
- **Path Issues**: Creates directories automatically

## File Formats

- **SQL Format**: INSERT statements for easy restoration
- **Timestamped**: Each backup session gets unique timestamp
- **Metadata**: Summary file includes row counts and table lists
- **Organized**: Each backup session in separate folder