// src/database/query-builder.interface.ts
import { PgTable } from 'drizzle-orm/pg-core';

export type ComparisonOperator = 
  | 'eq'        // equals
  | 'ne'        // not equals  
  | 'gt'        // greater than
  | 'gte'       // greater than or equal
  | 'lt'        // less than
  | 'lte'       // less than or equal
  | 'like'      // SQL LIKE
  | 'ilike'     // case-insensitive LIKE
  | 'in'        // IN array
  | 'notIn'     // NOT IN array
  | 'isNull'    // IS NULL
  | 'isNotNull' // IS NOT NULL
  | 'between';  // BETWEEN two values

export type LogicalOperator = 'and' | 'or';

export type SortDirection = 'asc' | 'desc';

export interface FilterCondition {
  field: string;
  operator: ComparisonOperator;
  value?: any;
  values?: any[]; // For 'in', 'notIn', 'between'
}

export interface LogicalGroup {
  operator: LogicalOperator;
  conditions: (FilterCondition | LogicalGroup)[];
}

export interface SortCondition {
  field: string;
  direction: SortDirection;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface QueryOptions {
  select?: string[]; // specific columns to select
  filters?: LogicalGroup;
  sort?: SortCondition[];
  pagination?: PaginationOptions;
  distinct?: boolean;
}

export interface QueryResult<T> {
  data: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  metadata: {
    executionTime: number;
    queryHash: string;
    resultCount: number;
  };
}

// Example JSON query format:
export const ExampleQuery = {
  select: ['id', 'email', 'firstName', 'lastName'],
  filters: {
    operator: 'and',
    conditions: [
      {
        field: 'isDeleted',
        operator: 'eq',
        value: false
      },
      {
        operator: 'or',
        conditions: [
          {
            field: 'email',
            operator: 'like',
            value: '%@company.com'
          },
          {
            field: 'role',
            operator: 'in',
            values: ['admin', 'manager']
          }
        ]
      }
    ]
  },
  sort: [
    { field: 'createdAt', direction: 'desc' },
    { field: 'email', direction: 'asc' }
  ],
  pagination: {
    page: 1,
    limit: 20
  }
} as QueryOptions;