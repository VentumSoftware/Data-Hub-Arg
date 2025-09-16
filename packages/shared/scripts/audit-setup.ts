#!/usr/bin/env ts-node
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import * as YAML from 'yaml';
import { sql } from 'drizzle-orm';

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

interface DatabaseConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
}

/**
 * Universal CDC/Audit Tables Setup Script
 * Can be used by any microservice with Drizzle
 * 
 * Usage:
 *   npx ts-node audit-setup.ts [--service=<service-name>] [--config=<config-path>]
 * 
 * Examples:
 *   npx ts-node audit-setup.ts --service=backend
 *   npx ts-node audit-setup.ts --service=indexes --config=./custom-audit.yml
 */
export class UniversalAuditSetup {
  private db: any;
  private pool: Pool;
  private auditConfig!: AuditConfig;
  private serviceName: string;
  private configPath: string;
  private serviceRoot: string;

  constructor(serviceName: string = 'backend', configPath?: string) {
    this.serviceName = serviceName;
    this.serviceRoot = this.resolveServiceRoot(serviceName);
    this.configPath = configPath || join(this.serviceRoot, 'drizzle/config/audit-tables.yml');
    
    // Load database configuration based on service
    const dbConfig = this.getDatabaseConfig(serviceName);
    
    this.pool = new Pool({
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
      password: dbConfig.password,
      ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false
    });
    
    this.db = drizzle(this.pool);
    
    // Load audit configuration
    this.loadAuditConfig();
  }

  private resolveServiceRoot(serviceName: string): string {
    // Try to find the service directory
    const possiblePaths = [
      join(process.cwd(), '..', serviceName),
      join(process.cwd(), 'packages', serviceName),
      join(process.cwd(), '..', '..', 'packages', serviceName),
      join(process.cwd(), '..', '..', serviceName),
      process.cwd() // Current directory as fallback
    ];

    for (const path of possiblePaths) {
      if (existsSync(join(path, 'package.json'))) {
        console.log(`📁 Found service root: ${path}`);
        return path;
      }
    }

    // Default to current directory
    console.log(`⚠️  Could not find service directory for ${serviceName}, using current directory`);
    return process.cwd();
  }

  private getDatabaseConfig(serviceName: string): DatabaseConfig {
    // Service-specific database configurations
    const configs: Record<string, DatabaseConfig> = {
      backend: {
        host: process.env.POSTGRES_HOST || process.env.DDBB_CONNECTION_HOST || 'postgres',
        port: parseInt(process.env.POSTGRES_PORT || process.env.DDBB_CONNECTION_PORT || '5432'),
        database: process.env.POSTGRES_DB || process.env.DDBB_CONNECTION_DATABASE || 'app_local',
        user: process.env.POSTGRES_USER || process.env.DDBB_CONNECTION_USER || 'app_user',
        password: process.env.POSTGRES_PASSWORD || process.env.DDBB_CONNECTION_PASSWORD || 'app_password',
        ssl: (process.env.POSTGRES_SSL || process.env.DDBB_CONNECTION_SSL) === 'true'
      },
      indexes: {
        host: process.env.INDEXES_DB_HOST || 'localhost',
        port: parseInt(process.env.INDEXES_DB_PORT || '5433'),
        database: process.env.INDEXES_DB_NAME || 'indexes_local',
        user: process.env.INDEXES_DB_USER || 'indexes_user',
        password: process.env.INDEXES_DB_PASSWORD || 'indexes_password',
        ssl: process.env.INDEXES_DB_SSL === 'true'
      },
      'indexes-service': {
        host: process.env.INDEXES_DB_HOST || 'localhost',
        port: parseInt(process.env.INDEXES_DB_PORT || '5433'),
        database: process.env.INDEXES_DB_NAME || 'indexes_local',
        user: process.env.INDEXES_DB_USER || 'indexes_user',
        password: process.env.INDEXES_DB_PASSWORD || 'indexes_password',
        ssl: process.env.INDEXES_DB_SSL === 'true'
      }
    };

    const config = configs[serviceName] || configs.backend;
    console.log(`🔌 Using database configuration for service: ${serviceName}`);
    console.log(`   Database: ${config.database} on ${config.host}:${config.port}`);
    
    return config;
  }

  private loadAuditConfig() {
    try {
      if (!existsSync(this.configPath)) {
        console.log(`⚠️  Audit config not found at ${this.configPath}, creating default...`);
        this.createDefaultConfig();
      }

      const configYaml = readFileSync(this.configPath, 'utf8');
      this.auditConfig = YAML.parse(configYaml) as AuditConfig;
      console.log(`📋 Loaded CDC configuration for ${this.serviceName}`);
      console.log(`   Prefix: "${this.auditConfig.audit.config.prefix}"`);
      console.log(`   Enabled tables: ${this.auditConfig.audit.tables.filter(t => t.enabled).length}`);
    } catch (error) {
      console.error('❌ Failed to load audit configuration:', error);
      throw error;
    }
  }

  private createDefaultConfig() {
    const defaultConfig = {
      audit: {
        config: {
          prefix: "_cdc_",
          enabled: true
        },
        tables: [],
        operations: ["INSERT", "UPDATE", "DELETE"]
      }
    };

    const configDir = join(this.serviceRoot, 'drizzle/config');
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    writeFileSync(this.configPath, YAML.stringify(defaultConfig, { indent: 2 }));
    console.log(`✅ Created default audit config at ${this.configPath}`);
  }

  /**
   * Discover tables in the database
   */
  async discoverTables(): Promise<string[]> {
    const query = sql.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    const result = await this.db.execute(query);
    const rows = Array.isArray(result) ? result : (result.rows || []);
    return rows.map((row: any) => row.table_name);
  }

  /**
   * Create CDC tables in the database
   */
  async createCDCTables() {
    if (!this.auditConfig.audit.config.enabled) {
      console.log('⚠️  CDC is disabled in configuration');
      return;
    }

    console.log('🏗️  Creating CDC tables...');
    
    const enabledTables = this.auditConfig.audit.tables.filter(table => table.enabled);
    
    if (enabledTables.length === 0) {
      console.log('⚠️  No tables enabled for CDC. Discovering available tables...');
      const availableTables = await this.discoverTables();
      console.log(`   Found ${availableTables.length} tables: ${availableTables.join(', ')}`);
      console.log('   Add these to your audit-tables.yml configuration to enable CDC.');
      return;
    }
    
    for (const table of enabledTables) {
      try {
        await this.createSingleCDCTable(table.name);
        console.log(`  ✅ Created CDC table: ${this.auditConfig.audit.config.prefix}${table.name}`);
      } catch (error: any) {
        console.error(`  ❌ Failed to create CDC table for ${table.name}: ${error.message}`);
      }
    }
    
    console.log('✅ CDC tables creation completed');
  }

  /**
   * Create a single CDC table that mirrors the original table
   */
  private async createSingleCDCTable(tableName: string) {
    const cdcTableName = `${this.auditConfig.audit.config.prefix}${tableName}`;
    const cdcPrefix = this.auditConfig.audit.config.prefix;
    
    // First, get the column information from the original table
    const columnsQuery = sql.raw(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = '${tableName}'
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    
    const result = await this.db.execute(columnsQuery);
    const columns = Array.isArray(result) ? result : (result.rows || []);
    
    if (columns.length === 0) {
      throw new Error(`Table ${tableName} not found or has no columns`);
    }
    
    // Build the CREATE TABLE statement
    let createTableSQL = `CREATE TABLE IF NOT EXISTS "${cdcTableName}" (\n`;
    
    // Add CDC-specific columns first
    createTableSQL += `  -- CDC Metadata Columns\n`;
    createTableSQL += `  "${cdcPrefix}id" SERIAL PRIMARY KEY,\n`;
    createTableSQL += `  "${cdcPrefix}timestamp" TIMESTAMP NOT NULL DEFAULT NOW(),\n`;
    createTableSQL += `  "${cdcPrefix}operation" VARCHAR(10) NOT NULL CHECK ("${cdcPrefix}operation" IN ('INSERT', 'UPDATE', 'DELETE')),\n`;
    createTableSQL += `  "${cdcPrefix}acknowledge" BOOLEAN NOT NULL DEFAULT FALSE,\n`;
    createTableSQL += `  \n`;
    createTableSQL += `  -- Original Table Columns (as nullable for DELETE operations)\n`;
    
    // Add original table columns (all nullable in CDC table)
    for (const col of columns) {
      const columnName = col.column_name;
      let columnType = this.mapPostgresType(col);
      
      // Make all columns nullable in CDC table (for DELETE operations)
      createTableSQL += `  "${columnName}" ${columnType},\n`;
    }
    
    // Remove trailing comma and close the table definition
    createTableSQL = createTableSQL.slice(0, -2) + '\n);\n\n';
    
    // Add indexes for efficient querying
    createTableSQL += `-- Indexes for efficient CDC querying\n`;
    createTableSQL += `CREATE INDEX IF NOT EXISTS "idx_${cdcTableName}_timestamp" ON "${cdcTableName}" ("${cdcPrefix}timestamp");\n`;
    createTableSQL += `CREATE INDEX IF NOT EXISTS "idx_${cdcTableName}_operation" ON "${cdcTableName}" ("${cdcPrefix}operation");\n`;
    createTableSQL += `CREATE INDEX IF NOT EXISTS "idx_${cdcTableName}_acknowledge" ON "${cdcTableName}" ("${cdcPrefix}acknowledge");\n`;
    createTableSQL += `CREATE INDEX IF NOT EXISTS "idx_${cdcTableName}_unprocessed" ON "${cdcTableName}" ("${cdcPrefix}acknowledge", "${cdcPrefix}timestamp") WHERE "${cdcPrefix}acknowledge" = FALSE;\n`;
    
    // Execute the CREATE TABLE statement
    await this.db.execute(sql.raw(createTableSQL));
  }

  /**
   * Map PostgreSQL column types from information_schema to DDL
   */
  private mapPostgresType(column: any): string {
    const dataType = column.data_type.toLowerCase();
    
    switch (dataType) {
      case 'integer':
      case 'bigint':
      case 'smallint':
        return dataType.toUpperCase();
      
      case 'character varying':
      case 'varchar':
        return column.character_maximum_length 
          ? `VARCHAR(${column.character_maximum_length})`
          : 'VARCHAR';
      
      case 'text':
        return 'TEXT';
      
      case 'boolean':
        return 'BOOLEAN';
      
      case 'timestamp without time zone':
      case 'timestamp':
        return 'TIMESTAMP';
      
      case 'timestamp with time zone':
        return 'TIMESTAMPTZ';
      
      case 'date':
        return 'DATE';
      
      case 'numeric':
      case 'decimal':
        if (column.numeric_precision && column.numeric_scale) {
          return `DECIMAL(${column.numeric_precision}, ${column.numeric_scale})`;
        }
        return 'DECIMAL';
      
      case 'json':
        return 'JSON';
      
      case 'jsonb':
        return 'JSONB';
      
      case 'uuid':
        return 'UUID';
      
      case 'user-defined':
        // Handle enums and custom types
        return 'TEXT'; // Fallback to TEXT for custom types
      
      default:
        console.warn(`  ⚠️  Unknown data type: ${dataType}, using TEXT`);
        return 'TEXT';
    }
  }

  /**
   * Create CDC triggers for all enabled tables
   */
  async createCDCTriggers() {
    if (!this.auditConfig.audit.config.enabled) {
      console.log('⚠️  CDC is disabled in configuration');
      return;
    }

    console.log('⚡ Creating CDC triggers...');
    
    const cdcPrefix = this.auditConfig.audit.config.prefix;
    
    // Create the universal CDC trigger function
    const triggerFunctionSQL = `
CREATE OR REPLACE FUNCTION ${this.serviceName}_universal_cdc_trigger() RETURNS TRIGGER AS $$
DECLARE
  cdc_table_name TEXT;
  cdc_prefix TEXT := '${cdcPrefix}';
  insert_columns TEXT;
  select_columns TEXT;
  col RECORD;
BEGIN
  -- Construct CDC table name
  cdc_table_name := cdc_prefix || TG_TABLE_NAME;
  
  -- Build column lists dynamically
  insert_columns := '"' || cdc_prefix || 'timestamp", "' || cdc_prefix || 'operation", "' || cdc_prefix || 'acknowledge"';
  select_columns := 'NOW(), ''' || TG_OP || ''', FALSE';
  
  -- Add all columns from the original table
  FOR col IN 
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = TG_TABLE_NAME 
    AND table_schema = 'public'
    ORDER BY ordinal_position
  LOOP
    insert_columns := insert_columns || ', "' || col.column_name || '"';
    IF TG_OP = 'DELETE' THEN
      select_columns := select_columns || ', $1."' || col.column_name || '"';
    ELSE
      select_columns := select_columns || ', $2."' || col.column_name || '"';
    END IF;
  END LOOP;
  
  -- Execute the INSERT into CDC table
  IF TG_OP = 'DELETE' THEN
    EXECUTE format('INSERT INTO %I (%s) SELECT %s', cdc_table_name, insert_columns, select_columns) USING OLD, NULL;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    EXECUTE format('INSERT INTO %I (%s) SELECT %s', cdc_table_name, insert_columns, select_columns) USING NULL, NEW;
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    EXECUTE format('INSERT INTO %I (%s) SELECT %s', cdc_table_name, insert_columns, select_columns) USING NULL, NEW;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
    `;
    
    // Create the trigger function
    await this.db.execute(sql.raw(triggerFunctionSQL));
    console.log(`  ✅ Created universal CDC trigger function: ${this.serviceName}_universal_cdc_trigger`);
    
    // Create triggers for each enabled table
    const enabledTables = this.auditConfig.audit.tables.filter(table => table.enabled);
    
    for (const table of enabledTables) {
      try {
        const triggerName = `${table.name}_cdc_trigger`;
        const quotedTableName = `"${table.name}"`; // Quote table name for PostgreSQL
        
        // Drop existing trigger if it exists
        await this.db.execute(sql.raw(`DROP TRIGGER IF EXISTS ${triggerName} ON ${quotedTableName}`));
        
        // Create the trigger
        const createTriggerSQL = `
CREATE TRIGGER ${triggerName}
  AFTER INSERT OR UPDATE OR DELETE ON ${quotedTableName}
  FOR EACH ROW
  EXECUTE FUNCTION ${this.serviceName}_universal_cdc_trigger();
        `;
        
        await this.db.execute(sql.raw(createTriggerSQL));
        console.log(`  ✅ Created trigger: ${triggerName}`);
      } catch (error: any) {
        console.error(`  ❌ Failed to create trigger for ${table.name}: ${error.message}`);
      }
    }
    
    console.log('✅ CDC triggers creation completed');
  }

  /**
   * Generate SQL scripts for documentation
   */
  async generateSQLScripts() {
    if (!this.auditConfig.audit.config.enabled) {
      console.log('⚠️  CDC is disabled in configuration');
      return;
    }

    console.log('📝 Generating SQL scripts...');
    
    // Ensure generated directory exists
    const generatedDir = join(this.serviceRoot, 'drizzle/generated');
    if (!existsSync(generatedDir)) {
      mkdirSync(generatedDir, { recursive: true });
    }
    
    // Generate scripts
    await this.generateCreateTableScripts(generatedDir);
    await this.generateTriggerScripts(generatedDir);
    
    console.log('✅ SQL scripts generation completed');
  }

  private async generateCreateTableScripts(outputDir: string) {
    const cdcPrefix = this.auditConfig.audit.config.prefix;
    const enabledTables = this.auditConfig.audit.tables.filter(table => table.enabled);
    
    let sqlScript = `-- CDC Tables Creation Script for ${this.serviceName}\n`;
    sqlScript += `-- Generated at: ${new Date().toISOString()}\n`;
    sqlScript += `-- Prefix: ${cdcPrefix}\n`;
    sqlScript += `-- DO NOT EDIT THIS FILE MANUALLY\n\n`;
    
    for (const table of enabledTables) {
      const cdcTableName = `${cdcPrefix}${table.name}`;
      sqlScript += `-- ============================================\n`;
      sqlScript += `-- CDC Table for: ${table.name}\n`;
      sqlScript += `-- Description: ${table.description}\n`;
      sqlScript += `-- ============================================\n\n`;
      
      try {
        const columnsQuery = sql.raw(`
          SELECT 
            column_name,
            data_type,
            character_maximum_length,
            numeric_precision,
            numeric_scale
          FROM information_schema.columns
          WHERE table_name = '${table.name}'
          AND table_schema = 'public'
          ORDER BY ordinal_position;
        `);
        
        const result = await this.db.execute(columnsQuery);
        const columns = Array.isArray(result) ? result : (result.rows || []);
        
        if (columns.length > 0) {
          sqlScript += `CREATE TABLE IF NOT EXISTS "${cdcTableName}" (\n`;
          sqlScript += `  -- CDC Metadata Columns\n`;
          sqlScript += `  "${cdcPrefix}id" SERIAL PRIMARY KEY,\n`;
          sqlScript += `  "${cdcPrefix}timestamp" TIMESTAMP NOT NULL DEFAULT NOW(),\n`;
          sqlScript += `  "${cdcPrefix}operation" VARCHAR(10) NOT NULL CHECK ("${cdcPrefix}operation" IN ('INSERT', 'UPDATE', 'DELETE')),\n`;
          sqlScript += `  "${cdcPrefix}acknowledge" BOOLEAN NOT NULL DEFAULT FALSE,\n`;
          sqlScript += `  \n`;
          sqlScript += `  -- Original Table Columns\n`;
          
          for (const col of columns) {
            const columnType = this.mapPostgresType(col);
            sqlScript += `  "${col.column_name}" ${columnType},\n`;
          }
          
          sqlScript = sqlScript.slice(0, -2) + '\n);\n\n';
          
          // Add indexes
          sqlScript += `-- Indexes\n`;
          sqlScript += `CREATE INDEX IF NOT EXISTS "idx_${cdcTableName}_timestamp" ON "${cdcTableName}" ("${cdcPrefix}timestamp");\n`;
          sqlScript += `CREATE INDEX IF NOT EXISTS "idx_${cdcTableName}_operation" ON "${cdcTableName}" ("${cdcPrefix}operation");\n`;
          sqlScript += `CREATE INDEX IF NOT EXISTS "idx_${cdcTableName}_acknowledge" ON "${cdcTableName}" ("${cdcPrefix}acknowledge");\n`;
          sqlScript += `CREATE INDEX IF NOT EXISTS "idx_${cdcTableName}_unprocessed" ON "${cdcTableName}" ("${cdcPrefix}acknowledge", "${cdcPrefix}timestamp") WHERE "${cdcPrefix}acknowledge" = FALSE;\n\n`;
        }
      } catch (error) {
        sqlScript += `-- ERROR: Could not generate table structure for ${table.name}\n\n`;
      }
    }
    
    // Write to file
    const outputPath = join(outputDir, 'cdc-tables.sql');
    writeFileSync(outputPath, sqlScript);
    console.log(`  📄 Created: ${outputPath}`);
  }

  private async generateTriggerScripts(outputDir: string) {
    const cdcPrefix = this.auditConfig.audit.config.prefix;
    const enabledTables = this.auditConfig.audit.tables.filter(table => table.enabled);
    
    let sqlScript = `-- CDC Triggers Creation Script for ${this.serviceName}\n`;
    sqlScript += `-- Generated at: ${new Date().toISOString()}\n`;
    sqlScript += `-- Prefix: ${cdcPrefix}\n`;
    sqlScript += `-- DO NOT EDIT THIS FILE MANUALLY\n\n`;
    
    // Add the universal trigger function
    sqlScript += `-- ============================================\n`;
    sqlScript += `-- Universal CDC Trigger Function\n`;
    sqlScript += `-- ============================================\n\n`;
    
    sqlScript += `CREATE OR REPLACE FUNCTION ${this.serviceName}_universal_cdc_trigger() RETURNS TRIGGER AS $$
DECLARE
  cdc_table_name TEXT;
  cdc_prefix TEXT := '${cdcPrefix}';
  insert_columns TEXT;
  select_columns TEXT;
  col RECORD;
BEGIN
  -- Construct CDC table name
  cdc_table_name := cdc_prefix || TG_TABLE_NAME;
  
  -- Build column lists dynamically
  insert_columns := '"' || cdc_prefix || 'timestamp", "' || cdc_prefix || 'operation", "' || cdc_prefix || 'acknowledge"';
  select_columns := 'NOW(), ''' || TG_OP || ''', FALSE';
  
  -- Add all columns from the original table
  FOR col IN 
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = TG_TABLE_NAME 
    AND table_schema = 'public'
    ORDER BY ordinal_position
  LOOP
    insert_columns := insert_columns || ', "' || col.column_name || '"';
    IF TG_OP = 'DELETE' THEN
      select_columns := select_columns || ', $1."' || col.column_name || '"';
    ELSE
      select_columns := select_columns || ', $2."' || col.column_name || '"';
    END IF;
  END LOOP;
  
  -- Execute the INSERT into CDC table
  IF TG_OP = 'DELETE' THEN
    EXECUTE format('INSERT INTO %I (%s) SELECT %s', cdc_table_name, insert_columns, select_columns) USING OLD, NULL;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    EXECUTE format('INSERT INTO %I (%s) SELECT %s', cdc_table_name, insert_columns, select_columns) USING NULL, NEW;
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    EXECUTE format('INSERT INTO %I (%s) SELECT %s', cdc_table_name, insert_columns, select_columns) USING NULL, NEW;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;\n\n`;
    
    // Add triggers for each table
    sqlScript += `-- ============================================\n`;
    sqlScript += `-- Table Triggers\n`;
    sqlScript += `-- ============================================\n\n`;
    
    for (const table of enabledTables) {
      const triggerName = `${table.name}_cdc_trigger`;
      const quotedTableName = `"${table.name}"`; // Quote table name for PostgreSQL
      
      sqlScript += `-- Trigger for: ${table.name}\n`;
      sqlScript += `DROP TRIGGER IF EXISTS ${triggerName} ON ${quotedTableName};\n`;
      sqlScript += `CREATE TRIGGER ${triggerName}\n`;
      sqlScript += `  AFTER INSERT OR UPDATE OR DELETE ON ${quotedTableName}\n`;
      sqlScript += `  FOR EACH ROW\n`;
      sqlScript += `  EXECUTE FUNCTION ${this.serviceName}_universal_cdc_trigger();\n\n`;
    }
    
    // Write to file
    const outputPath = join(outputDir, 'cdc-triggers.sql');
    writeFileSync(outputPath, sqlScript);
    console.log(`  📄 Created: ${outputPath}`);
  }

  /**
   * Run complete CDC setup
   */
  async runCDCSetup() {
    console.log(`🚀 Starting CDC setup for ${this.serviceName}...`);
    console.log('================================================\n');
    
    try {
      // Generate SQL scripts first
      await this.generateSQLScripts();
      
      // Create CDC tables
      await this.createCDCTables();
      
      // Create CDC triggers
      await this.createCDCTriggers();
      
      console.log('\n================================================');
      console.log(`🎉 CDC setup completed successfully for ${this.serviceName}!`);
    } catch (error) {
      console.error('\n================================================');
      console.error(`❌ CDC setup failed for ${this.serviceName}:`, error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    await this.pool.end();
  }
}

// Parse command line arguments
function parseArgs(): { service: string; config?: string } {
  const args = process.argv.slice(2);
  let service = 'backend';
  let config: string | undefined;
  
  for (const arg of args) {
    if (arg.startsWith('--service=')) {
      service = arg.split('=')[1];
    } else if (arg.startsWith('--config=')) {
      config = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Universal CDC/Audit Setup Script

Usage:
  npx ts-node audit-setup.ts [options]

Options:
  --service=<name>    Service name (default: backend)
                      Examples: backend, indexes, indexes-service
  
  --config=<path>     Path to audit configuration YAML file
                      Default: <service-root>/drizzle/config/audit-tables.yml
  
  --help, -h          Show this help message

Examples:
  npx ts-node audit-setup.ts --service=backend
  npx ts-node audit-setup.ts --service=indexes
  npx ts-node audit-setup.ts --service=indexes --config=./custom-audit.yml
`);
      process.exit(0);
    }
  }
  
  return { service, config };
}

// Run if called directly
if (require.main === module) {
  const { service, config } = parseArgs();
  const setup = new UniversalAuditSetup(service, config);
  
  setup.runCDCSetup().catch((error) => {
    console.error('Audit setup failed:', error);
    process.exit(1);
  });
}