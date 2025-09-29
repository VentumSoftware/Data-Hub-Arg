// drizzle/setup-cdc-complete.ts
import { config } from 'dotenv';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import * as YAML from 'yaml';

// Load environment variables
config();

interface AuditConfig {
    audit: {
        config: { prefix: string; enabled: boolean };
        tables: Array<{ name: string; enabled: boolean; description: string }>;
        operations: string[];
    };
}

class CDCSetupComplete {
    private pool: Pool;
    private config: AuditConfig;

    constructor() {
        this.initializeDBConnection();
        this.loadConfig();
    }

    private initializeDBConnection(): void {
        let dbConfig: any;

        if (process.env.DATABASE_URL) {
            dbConfig = { connectionString: process.env.DATABASE_URL };
        } else {
            const useSSL = (process.env.POSTGRES_SSL || process.env.DDBB_CONNECTION_SSL) === 'true';

            dbConfig = {
                host: process.env.POSTGRES_HOST || process.env.DDBB_CONNECTION_HOST || 'localhost',
                port: parseInt(process.env.POSTGRES_PORT || process.env.DDBB_CONNECTION_PORT || '5432'),
                database: process.env.POSTGRES_DB || process.env.DDBB_CONNECTION_DATABASE || 'app_main',
                user: process.env.POSTGRES_USER || process.env.DDBB_CONNECTION_USER || 'app_user',
                password: process.env.POSTGRES_PASSWORD || process.env.DDBB_CONNECTION_PASSWORD || 'app_password',
                ssl: useSSL ? { rejectUnauthorized: false } : false
            };
        }

        console.log('🔗 Connecting to database...');
        this.pool = new Pool(dbConfig);
    }

    private loadConfig(): void {
        try {
            const configPath = join(__dirname, 'config/audit-tables.yml');
            const configYaml = readFileSync(configPath, 'utf8');
            this.config = YAML.parse(configYaml) as AuditConfig;
            console.log('📋 Loaded CDC configuration');
        } catch (error) {
            console.error('❌ Failed to load audit configuration:', error);
            throw error;
        }
    }

    private async generateCDCTableSQL(baseTable: string): Promise<string> {
        const columns = await this.getTableColumns(baseTable);
     console.log({columns});
        return `
CREATE TABLE IF NOT EXISTS "_cdc_${baseTable}" (
  "_cdc_id" SERIAL PRIMARY KEY,
  "_cdc_timestamp" TIMESTAMP NOT NULL DEFAULT NOW(),
  "_cdc_operation" VARCHAR(10) NOT NULL CHECK ("_cdc_operation" IN ('INSERT', 'UPDATE', 'DELETE')),
  "_cdc_acknowledge" BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Original Table Columns
  ${columns.join(",\n  ")}
);

CREATE INDEX IF NOT EXISTS "idx_cdc_${baseTable}_timestamp" ON "_cdc_${baseTable}" ("_cdc_timestamp");
CREATE INDEX IF NOT EXISTS "idx_cdc_${baseTable}_operation" ON "_cdc_${baseTable}" ("_cdc_operation");
CREATE INDEX IF NOT EXISTS "idx_cdc_${baseTable}_unprocessed" ON "_cdc_${baseTable}" ("_cdc_acknowledge", "_cdc_timestamp") WHERE "_cdc_acknowledge" = FALSE;
`;
    }

    private async generateTriggerFunctionForTable(tableName: string): Promise<string> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = $1
            ORDER BY ordinal_position
        `, [tableName]);

            const cols = result.rows.map(r => r.column_name);
            const colList = cols.map(c => `"${c}"`).join(", ");
            const valListNew = cols.map(c => `NEW.${c}`).join(", ");
            const valListOld = cols.map(c => `OLD.${c}`).join(", ");

            return `
CREATE OR REPLACE FUNCTION cdc_trigger_function_${tableName}()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO "_cdc_${tableName}" (_cdc_operation, _cdc_acknowledge, ${colList})
    VALUES ('DELETE', false, ${valListOld});
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO "_cdc_${tableName}" (_cdc_operation, _cdc_acknowledge, ${colList})
    VALUES ('UPDATE', false, ${valListNew});
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO "_cdc_${tableName}" (_cdc_operation, _cdc_acknowledge, ${colList})
    VALUES ('INSERT', false, ${valListNew});
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
        `;
        } finally {
            client.release();
        }
    }

    private async createCDCTables(): Promise<void> {
        if (!this.config.audit.config.enabled) {
            console.log('📋 CDC is disabled in configuration');
            return;
        }

        const enabledTables = this.config.audit.tables.filter(t => t.enabled);
        console.log(`📋 Creating ${enabledTables.length} CDC tables`);

        const client = await this.pool.connect();

        try {
            for (const table of enabledTables) {
                console.log(`🛠️  Creating CDC table for: ${table.name}`);
                const sql = await this.generateCDCTableSQL(table.name); // 👈 ahora es async
                await client.query(sql);
            }
            console.log('✅ All CDC tables created');
        } finally {
            client.release();
        }
    }

    private async createTriggers(): Promise<void> {
        const enabledTables = this.config.audit.tables.filter(t => t.enabled);
        console.log(`🔧 Creating triggers for ${enabledTables.length} tables`);

        const client = await this.pool.connect();

        try {
            for (const table of enabledTables) {
                console.log(`🛠️  Creating trigger function for: ${table.name}`);
                const triggerFnSQL = await this.generateTriggerFunctionForTable(table.name);
                await client.query(triggerFnSQL);

                console.log(`🔧 Creating trigger for: ${table.name}`);
                await client.query(`
                DROP TRIGGER IF EXISTS cdc_trigger_${table.name} ON "${table.name}";
                CREATE TRIGGER cdc_trigger_${table.name}
                  AFTER INSERT OR UPDATE OR DELETE ON "${table.name}"
                  FOR EACH ROW EXECUTE FUNCTION cdc_trigger_function_${table.name}();
            `);
            }

            console.log('✅ All triggers created');
        } finally {
            client.release();
        }
    }

    private async backupExistingCDC(): Promise<void> {
        console.log('💾 Checking for existing CDC tables...');

        const client = await this.pool.connect();
        try {
            const result = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE '_cdc_%'
      `);

            if (result.rows.length > 0) {
                console.log(`⚠️  Found ${result.rows.length} existing CDC tables:`);
                result.rows.forEach(row => console.log(`   - ${row.table_name}`));

                // Create backup directory
                const backupDir = join(__dirname, '../../local/backups/cdc');
                if (!existsSync(backupDir)) {
                    mkdirSync(backupDir, { recursive: true });
                }
                console.log(`📁 Backup directory: ${backupDir}`);
            } else {
                console.log('📋 No existing CDC tables found');
            }
        } finally {
            client.release();
        }
    }

    async setupCompleteCDC(): Promise<void> {
        console.log('🚀 Starting complete CDC setup...');

        try {
            // 1. Backup existing CDC tables
            //await this.backupExistingCDC();

            // 2. Create CDC tables
            await this.createCDCTables();

            // 3. Create triggers
            await this.createTriggers();

            // 4. Verify setup
            await this.verifySetup();

            console.log('🎉 CDC setup completed successfully!');

        } catch (error) {
            console.error('❌ CDC setup failed:', error);
            throw error;
        }
    }
   private async getTableColumns(tableName: string): Promise<string[]> {
    const client = await this.pool.connect();
    try {
        const result = await client.query(`
            SELECT 
                column_name, 
                data_type, 
                character_maximum_length,
                udt_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = $1
            ORDER BY ordinal_position
        `, [tableName]);

        return result.rows.map(row => {
            if (row.data_type === 'character varying') {
                return row.character_maximum_length
                    ? `"${row.column_name}" VARCHAR(${row.character_maximum_length})`
                    : `"${row.column_name}" TEXT`;
            }
            if (row.data_type === 'USER-DEFINED') {
                return `"${row.column_name}" ${row.udt_name}`; // 👈 usar el tipo real
            }
            return `"${row.column_name}" ${row.data_type.toUpperCase()}`;
        });
    } finally {
        client.release();
    }
}

    private async verifySetup(): Promise<void> {
        console.log('🔍 Verifying CDC setup...');

        const client = await this.pool.connect();
        try {
            // Check tables
            const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE '_cdc_%'
        ORDER BY table_name;
      `);

            console.log(`✅ CDC tables created: ${tablesResult.rows.length}`);
            tablesResult.rows.forEach(row => console.log(`   - ${row.table_name}`));

            // Check triggers
            const triggersResult = await client.query(`
        SELECT trigger_name, event_object_table 
        FROM information_schema.triggers 
        WHERE trigger_name LIKE 'cdc_trigger_%'
        ORDER BY event_object_table;
      `);

            console.log(`✅ CDC triggers created: ${triggersResult.rows.length}`);
            triggersResult.rows.forEach(row => console.log(`   - ${row.trigger_name} on ${row.event_object_table}`));

        } finally {
            client.release();
        }
    }

    async cleanup(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
        }
    }
}

// Main execution
async function main() {
    const cdcSetup = new CDCSetupComplete();

    try {
        await cdcSetup.setupCompleteCDC();
        process.exit(0);
    } catch (error) {
        console.error('💥 CDC setup failed:', error);
        process.exit(1);
    } finally {
        await cdcSetup.cleanup();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

export { CDCSetupComplete };