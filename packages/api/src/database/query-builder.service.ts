// src/database/query-builder.service.ts
import { Injectable } from '@nestjs/common';
import { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import { 
  eq, ne, gt, gte, lt, lte, like, ilike, 
  inArray, notInArray, isNull, isNotNull, between,
  and, or, asc, desc, count, sql
} from 'drizzle-orm';
import { DatabaseService } from './database.service';
import { 
  QueryOptions, 
  QueryResult, 
  FilterCondition, 
  LogicalGroup,
  ComparisonOperator 
} from './query-builder.interface';
import * as crypto from 'crypto';

@Injectable()
export class QueryBuilderService {
  constructor(private readonly dbService: DatabaseService) {}

  /**
   * Execute a generic query on any table with JSON-based configuration
   * @param table - Drizzle table object
   * @param options - Query configuration as JSON
   * @returns Promise<QueryResult<T>> - Results with metadata and pagination
   */
  async executeQuery<T extends PgTable>(
    table: T,
    options: QueryOptions = {}
  ): Promise<QueryResult<any>> {
    const startTime = Date.now();
    
    try {
      // Validate the query options
      this.validateQueryOptions(table, options);
      
      // Build the base query - use any to simplify types
      let query: any = this.dbService.db.select().from(table as any);
      
      // Apply column selection
      if (options.select && options.select.length > 0) {
        const selectedColumns = this.buildSelectColumns(table, options.select);
        query = this.dbService.db.select(selectedColumns).from(table as any);
      }
      
      // Apply filters
      if (options.filters) {
        const whereClause = this.buildWhereClause(table, options.filters);
        query = query.where(whereClause);
      }
      
      // Apply sorting
      if (options.sort && options.sort.length > 0) {
        const orderByClause = this.buildOrderByClause(table, options.sort);
        query = query.orderBy(...orderByClause);
      }
      
      // Handle pagination
      let paginationInfo;
      if (options.pagination) {
        const { page, limit } = options.pagination;
        const offset = (page - 1) * limit;
        
        // Get total count for pagination metadata
        const countQuery = this.dbService.db
          .select({ count: count() })
          .from(table as any);
          
        if (options.filters) {
          const whereClause = this.buildWhereClause(table, options.filters);
          countQuery.where(whereClause);
        }
        
        const [{ count: total }] = await countQuery;
        const totalPages = Math.ceil(total / limit);
        
        paginationInfo = {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        };
        
        query = query.limit(limit).offset(offset);
      }
      
      // Apply DISTINCT if requested
      if (options.distinct) {
        query = query.distinct();
      }
      
      // Execute the query
      const results = await query;
      const executionTime = Date.now() - startTime;
      
      // Generate query hash for caching/debugging
      const queryHash = crypto
        .createHash('md5')
        .update(JSON.stringify(options))
        .digest('hex');
      
      return {
        data: results as T['$inferSelect'][],
        pagination: paginationInfo,
        metadata: {
          executionTime,
          queryHash,
          resultCount: results.length
        }
      };
      
    } catch (error) {
      console.error('❌ Query execution failed:', error);
      throw new Error(`Query execution failed: ${error.message}`);
    }
  }

  /**
   * Build WHERE clause from filter configuration
   */
  private buildWhereClause(table: PgTable, filters: LogicalGroup): any {
    const conditions = filters.conditions.map(condition => {
      if ('operator' in condition && condition.operator === 'and' || condition.operator === 'or') {
        // It's a nested logical group
        return this.buildWhereClause(table, condition as LogicalGroup);
      } else {
        // It's a filter condition
        return this.buildFilterCondition(table, condition as FilterCondition);
      }
    });

    return filters.operator === 'and' 
      ? and(...conditions)
      : or(...conditions);
  }

  /**
   * Build individual filter condition
   */
  private buildFilterCondition(table: PgTable, condition: FilterCondition): any {
    const column = this.getTableColumn(table, condition.field);
    
    switch (condition.operator) {
      case 'eq':
        return eq(column, condition.value);
      case 'ne':
        return ne(column, condition.value);
      case 'gt':
        return gt(column, condition.value);
      case 'gte':
        return gte(column, condition.value);
      case 'lt':
        return lt(column, condition.value);
      case 'lte':
        return lte(column, condition.value);
      case 'like':
        return like(column, condition.value);
      case 'ilike':
        return ilike(column, condition.value);
      case 'in':
        if (!condition.values || !Array.isArray(condition.values)) {
          throw new Error(`'in' operator requires 'values' array for field '${condition.field}'`);
        }
        return inArray(column, condition.values);
      case 'notIn':
        if (!condition.values || !Array.isArray(condition.values)) {
          throw new Error(`'notIn' operator requires 'values' array for field '${condition.field}'`);
        }
        return notInArray(column, condition.values);
      case 'isNull':
        return isNull(column);
      case 'isNotNull':
        return isNotNull(column);
      case 'between':
        if (!condition.values || condition.values.length !== 2) {
          throw new Error(`'between' operator requires exactly 2 values for field '${condition.field}'`);
        }
        return between(column, condition.values[0], condition.values[1]);
      default:
        throw new Error(`Unsupported operator: ${condition.operator}`);
    }
  }

  /**
   * Build ORDER BY clause from sort configuration
   */
  private buildOrderByClause(table: PgTable, sortConditions: QueryOptions['sort']): any[] {
    return sortConditions.map(sort => {
      const column = this.getTableColumn(table, sort.field);
      return sort.direction === 'asc' ? asc(column) : desc(column);
    });
  }

  /**
   * Build SELECT columns from field list
   */
  private buildSelectColumns(table: PgTable, selectFields: string[]): Record<string, any> {
    const columns: Record<string, any> = {};
    
    selectFields.forEach(fieldName => {
      const column = this.getTableColumn(table, fieldName);
      columns[fieldName] = column;
    });
    
    return columns;
  }

  /**
   * Get table column by name with validation
   */
  private getTableColumn(table: PgTable, fieldName: string): PgColumn {
    const column = table[fieldName];
    
    if (!column) {
      throw new Error(`Column '${fieldName}' does not exist in table '${table._.name}'`);
    }
    
    return column;
  }

  /**
   * Validate query options for security and correctness
   */
  private validateQueryOptions(table: PgTable, options: QueryOptions): void {
    // Validate select fields
    if (options.select) {
      options.select.forEach(field => {
        if (!table[field]) {
          throw new Error(`Invalid select field: '${field}' does not exist in table`);
        }
      });
    }

    // Validate filter fields
    if (options.filters) {
      this.validateFilters(table, options.filters);
    }

    // Validate sort fields
    if (options.sort) {
      options.sort.forEach(sort => {
        if (!table[sort.field]) {
          throw new Error(`Invalid sort field: '${sort.field}' does not exist in table`);
        }
      });
    }

    // Validate pagination
    if (options.pagination) {
      const { page, limit } = options.pagination;
      if (page < 1 || limit < 1 || limit > 1000) {
        throw new Error('Invalid pagination: page must be >= 1, limit must be 1-1000');
      }
    }
  }

  /**
   * Recursively validate filter conditions
   */
  private validateFilters(table: PgTable, filters: LogicalGroup): void {
    filters.conditions.forEach(condition => {
      if ('operator' in condition && (condition.operator === 'and' || condition.operator === 'or')) {
        // Recursive validation for nested groups
        this.validateFilters(table, condition as LogicalGroup);
      } else {
        // Validate field exists in table
        const filterCondition = condition as FilterCondition;
        if (!table[filterCondition.field]) {
          throw new Error(`Invalid filter field: '${filterCondition.field}' does not exist in table`);
        }
      }
    });
  }
}