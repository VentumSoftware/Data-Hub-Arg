// src/database/database.service.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../drizzle/schema';
import { ConfigModule } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import { PgTable } from 'drizzle-orm/pg-core';
import { QueryOptions, QueryResult } from './query-builder.interface';

type CdcRecord<T extends Record<string, any>> = {
  cdc_id: number;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  acknowledge: boolean;
  cdc_timestamp: Date;
} & T;

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
  };
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private auditConfig: AuditConfig;

  constructor() {
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    });
    this.loadAuditConfig();
  }

  private pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app_user:app_password@localhost:5432/app_local' });
  public readonly db = drizzle<typeof schema>(this.pool, { 
    schema,
    logger: {
      logQuery: (query, params) => {
        console.log('📊 SQL Query:', query);
        console.log('📊 Parameters:', params);
        
        // Check for UUID being passed to integer parameter
        if (params && params.some(p => typeof p === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p))) {
          console.error('🚨 UUID DETECTED IN QUERY PARAMETERS!');
          console.error('🚨 Query:', query);
          console.error('🚨 Params:', params);
          console.trace('🚨 Stack trace:');
        }
      }
    }
  });
  public readonly schema = schema;

  private loadAuditConfig() {
    try {
      const auditYaml = readFileSync(
        join(process.cwd(), 'drizzle/config/audit-tables.yml'),
        'utf8'
      );
      this.auditConfig = parse(auditYaml) as AuditConfig;
    } catch (error) {
      console.error('❌ Failed to load audit configuration:', error);
      // Fallback configuration
      this.auditConfig = {
        audit: {
          config: { prefix: '_cdc_', enabled: true },
          tables: []
        }
      };
    }
  }

  /**
   * Query CDC table data for a given drizzle table object
   * @param table - Drizzle table object (e.g., schema.users)
   * @returns Promise<CdcRecord<T>[]> - Array of CDC records with proper type inference
   */
  async getCdcTableData<T extends PgTable>(
    table: T
  ): Promise<CdcRecord<T['$inferSelect']>[]> {
    const tableName = table[Symbol.for('drizzle:Name')] || table._.name;
    
    // Validate that the table is configured for CDC
    const tableConfig = this.auditConfig.audit.tables.find(
      tableConfig => tableConfig.name === tableName && tableConfig.enabled
    );

    if (!tableConfig) {
      throw new Error(`Table '${tableName}' is not configured for CDC tracking or is disabled`);
    }

    const cdcTableName = `${this.auditConfig.audit.config.prefix}${tableName}`;

    try {
      // Check if CDC table exists
      const tableExists = await this.db.execute(sql`
        SELECT EXISTS (
          SELECT 1 
          FROM pg_tables 
          WHERE schemaname = 'public' 
          AND tablename = ${cdcTableName}
        ) as exists
      `);

      if (!tableExists[0]?.exists) {
        throw new Error(`CDC table '${cdcTableName}' does not exist`);
      }

      // Query all CDC data for the table
      const result = await this.db.execute(sql`
        SELECT * 
        FROM ${sql.identifier(cdcTableName)}
        ORDER BY cdc_timestamp DESC, cdc_id DESC
      `);

      return (result as any).rows as CdcRecord<T['$inferSelect']>[];

    } catch (error) {
      console.error(`❌ Failed to query CDC table '${cdcTableName}':`, error);
      throw error;
    }
  }

  /**
   * Get list of available CDC tables
   * @returns Promise<string[]> - Array of source table names that have CDC enabled
   */
  async getAvailableCdcTables(): Promise<string[]> {
    return this.auditConfig.audit.tables
      .filter(table => table.enabled)
      .map(table => table.name);
  }

  /**
   * Get CDC configuration info
   * @returns Object with CDC configuration details
   */
  getCdcConfig() {
    return {
      prefix: this.auditConfig.audit.config.prefix,
      enabled: this.auditConfig.audit.config.enabled,
      tables: this.auditConfig.audit.tables
    };
  }

  /**
   * Execute a generic query using JSON configuration (read-only)
   * @param table - Drizzle table object
   * @param queryOptions - JSON query configuration
   * @returns Promise<QueryResult<T>> - Query results with metadata
   */
  async executeGenericQuery<T extends PgTable>(
    table: T,
    queryOptions: QueryOptions = {}
  ): Promise<QueryResult<T['$inferSelect']>> {
    // Import QueryBuilderService dynamically to avoid circular dependency
    const { QueryBuilderService } = await import('./query-builder.service');
    const queryBuilder = new QueryBuilderService(this);
    
    return queryBuilder.executeQuery(table, queryOptions);
  }

  async onModuleDestroy() { await this.pool.end(); }
}

