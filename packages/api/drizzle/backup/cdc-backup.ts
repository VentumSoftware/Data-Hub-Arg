// packages/api/drizzle/backup/cdc-backup.ts
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import * as YAML from 'yaml';

// Load environment variables
config();

interface AuditConfig {
  audit: {
    config: {
      prefix: string;
      enabled: boolean;
    };
    tables: Array<{
      name: string;
      enabled: boolean;
      description: string;
    }>;
    operations: string[];
  };
}

interface BackupConfig {
  backup: {
    enabled: boolean;
    path: string;
    format: 'sql' | 'csv' | 'json';
    compress: boolean;
    retention_days: number;
  };
}

/**
 * CDC Table Backup System
 * Backs up CDC tables before migration that might delete them
 */
export class CDCBackup {
  private auditConfig: AuditConfig;
  private backupConfig: BackupConfig;
  private backupPath: string;
  private sessionBackupPath: string;

  constructor(customBackupPath?: string) {
    this.loadConfigurations();
    // Use custom path, or path from config, or default
    this.backupPath = customBackupPath || this.backupConfig.backup.path;
    
    // Create a unique backup session folder
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.sessionBackupPath = join(this.backupPath, `backup_${timestamp}`);
    
    this.ensureBackupDirectory();
  }

  private loadConfigurations() {
    try {
      // Load audit configuration
      const auditConfigYaml = readFileSync(
        join(__dirname, '../config/audit-tables.yml'),
        'utf8'
      );
      this.auditConfig = YAML.parse(auditConfigYaml) as AuditConfig;

      // Load backup configuration (with defaults)  
      const defaultBackupConfig: BackupConfig = {
        backup: {
          enabled: true,
          path: join(__dirname, '../../../../../local/backups/drizzle/cdc'),
          format: 'sql',
          compress: false,
          retention_days: 30
        }
      };

      try {
        const backupConfigPath = join(__dirname, '../config/backup.yml');
        const backupConfigYaml = readFileSync(backupConfigPath, 'utf8');
        this.backupConfig = YAML.parse(backupConfigYaml) as BackupConfig;
        
        // Resolve relative path from the backup directory
        if (this.backupConfig.backup.path && !require('path').isAbsolute(this.backupConfig.backup.path)) {
          this.backupConfig.backup.path = join(__dirname, this.backupConfig.backup.path);
        }
      } catch (error) {
        // Use defaults if backup config doesn't exist
        console.log(`⚠️ Failed to load backup config: ${error.message}`);
        this.backupConfig = defaultBackupConfig;
        console.log('📋 Using default backup configuration');
      }

      console.log(`📋 Loaded configurations - CDC prefix: ${this.auditConfig.audit.config.prefix}`);
    } catch (error) {
      console.error('❌ Failed to load configurations:', error);
      throw error;
    }
  }

  private ensureBackupDirectory() {
    try {
      // Ensure main backup directory exists
      if (!existsSync(this.backupPath)) {
        mkdirSync(this.backupPath, { recursive: true });
        console.log(`📁 Created main backup directory: ${this.backupPath}`);
      }
      
      // Ensure session backup directory exists
      if (!existsSync(this.sessionBackupPath)) {
        mkdirSync(this.sessionBackupPath, { recursive: true });
        console.log(`📁 Created backup session directory: ${this.sessionBackupPath}`);
      }
    } catch (error) {
      console.error('❌ Failed to create backup directory:', error);
      throw error;
    }
  }

  /**
   * Check which CDC tables exist in the database
   */
  async getCDCTables(): Promise<string[]> {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    try {
      const command = `docker exec ${process.env.APP_NAME || 'app'}-postgres-dev psql -U ${process.env.POSTGRES_USER || 'app_user'} -d ${process.env.POSTGRES_DB || 'app_local'} -t -c "SELECT tablename FROM pg_tables WHERE tablename LIKE '${this.auditConfig.audit.config.prefix}%' ORDER BY tablename;"`;
      
      const { stdout } = await execAsync(command);
      const tables = stdout
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0);

      return tables;
    } catch (error) {
      console.error('❌ Failed to get CDC tables:', error);
      return [];
    }
  }

  /**
   * Get table row count
   */
  async getTableRowCount(tableName: string): Promise<number> {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    try {
      const command = `docker exec ${process.env.APP_NAME || 'app'}-postgres psql -U ${process.env.POSTGRES_USER || 'app_user'} -d ${process.env.POSTGRES_DB || 'app_local'} -t -c "SELECT COUNT(*) FROM \\"${tableName}\\""`;
      
      const { stdout } = await execAsync(command);
      return parseInt(stdout.trim()) || 0;
    } catch (error) {
      console.warn(`⚠️  Could not get row count for ${tableName}:`, error);
      return 0;
    }
  }

  /**
   * Backup a specific CDC table
   */
  async backupTable(tableName: string): Promise<string> {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    const backupFileName = `${tableName}.sql`;
    const backupFilePath = join(this.sessionBackupPath, backupFileName);

    try {
      console.log(`💾 Backing up table: ${tableName}`);
      
      // Get row count first
      const rowCount = await this.getTableRowCount(tableName);
      
      if (rowCount === 0) {
        console.log(`⚠️  Table ${tableName} is empty, skipping backup`);
        return '';
      }

      const command = `docker exec ${process.env.APP_NAME || 'app'}-postgres pg_dump -U ${process.env.POSTGRES_USER || 'app_user'} -d ${process.env.POSTGRES_DB || 'app_local'} --table="\\"${tableName}\\"" --data-only --inserts > "${backupFilePath}"`;
      
      await execAsync(command);
      
      console.log(`✅ Backed up ${tableName} (${rowCount} rows) to: ${backupFilePath}`);
      return backupFilePath;
    } catch (error) {
      console.error(`❌ Failed to backup table ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Backup all CDC tables
   */
  async backupAllCDCTables(): Promise<string[]> {
    if (!this.backupConfig.backup.enabled) {
      console.log('📋 CDC backup is disabled in configuration');
      return [];
    }

    console.log('🚀 Starting CDC table backup...');
    
    const cdcTables = await this.getCDCTables();
    
    if (cdcTables.length === 0) {
      console.log('📋 No CDC tables found to backup');
      return [];
    }

    console.log(`📋 Found ${cdcTables.length} CDC tables to backup: ${cdcTables.join(', ')}`);
    
    const backupFiles: string[] = [];
    let totalRows = 0;

    for (const table of cdcTables) {
      try {
        const rowCount = await this.getTableRowCount(table);
        totalRows += rowCount;
        
        if (rowCount > 0) {
          const backupFile = await this.backupTable(table);
          if (backupFile) {
            backupFiles.push(backupFile);
          }
        }
      } catch (error) {
        console.error(`❌ Failed to backup ${table}:`, error);
        // Continue with other tables
      }
    }

    if (backupFiles.length > 0) {
      // Create a summary file with backup information
      const summaryFile = join(this.sessionBackupPath, 'backup-summary.txt');
      const summaryContent = [
        `CDC Backup Summary`,
        `==================`,
        `Backup Date: ${new Date().toISOString()}`,
        `Total Tables: ${cdcTables.length}`,
        `Tables Backed Up: ${backupFiles.length}`,
        `Total Rows: ${totalRows}`,
        ``,
        `Tables:`,
        ...cdcTables.map(table => `- ${table}`),
        ``,
        `Backup Files:`,
        ...backupFiles.map(file => `- ${file.split('/').pop()}`),
        ``
      ].join('\n');
      
      require('fs').writeFileSync(summaryFile, summaryContent);
      
      console.log(`✅ CDC backup completed! ${backupFiles.length} tables backed up (${totalRows} total rows)`);
      console.log(`📁 Backup location: ${this.sessionBackupPath}`);
      console.log(`📄 Backup summary: ${summaryFile}`);
    } else {
      console.log('📋 No data to backup (all CDC tables were empty)');
    }

    return backupFiles;
  }

  /**
   * Interactive backup prompt
   */
  async promptForBackup(): Promise<boolean> {
    const cdcTables = await this.getCDCTables();
    
    if (cdcTables.length === 0) {
      return false;
    }

    let totalRows = 0;
    for (const table of cdcTables) {
      totalRows += await this.getTableRowCount(table);
    }

    if (totalRows === 0) {
      console.log('📋 All CDC tables are empty, no backup needed');
      return false;
    }

    console.log(`\n⚠️  Warning: Migration will delete ${cdcTables.length} CDC tables with ${totalRows} total rows:`);
    cdcTables.forEach(table => console.log(`  - ${table}`));
    console.log(`\n📁 Backup will be created in: ${this.sessionBackupPath}`);
    
    // In a real CLI, you'd use a proper prompt library like inquirer
    // For now, we'll assume the user wants to backup
    console.log('\n🔍 Would you like to backup these tables before migration? (Recommended)');
    console.log('💾 Creating backup automatically...\n');
    
    return true;
  }

  /**
   * Main backup workflow
   */
  async runBackup(interactive: boolean = true): Promise<string[]> {
    try {
      if (interactive) {
        const shouldBackup = await this.promptForBackup();
        if (!shouldBackup) {
          return [];
        }
      }

      return await this.backupAllCDCTables();
    } catch (error) {
      console.error('❌ Backup failed:', error);
      throw error;
    }
  }
}

// Export for use in other scripts
export default CDCBackup;

// Run if called directly
if (require.main === module) {
  const customPath = process.argv[2]; // Allow custom path as command line argument
  const backup = new CDCBackup(customPath);
  
  backup.runBackup(true).catch((error) => {
    console.error('Backup failed:', error);
    process.exit(1);
  });
}