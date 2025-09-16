// src/database/query-examples.ts
// Example usage of the generic query builder

import { QueryOptions } from './query-builder.interface';

// Example 1: Simple user query with filters
export const getUsersQuery: QueryOptions = {
  select: ['id', 'email', 'firstName', 'lastName', 'isDeleted'],
  filters: {
    operator: 'and',
    conditions: [
      {
        field: 'isDeleted',
        operator: 'eq',
        value: false
      },
      {
        field: 'email',
        operator: 'like',
        value: '%@company.com'
      }
    ]
  },
  sort: [
    { field: 'firstName', direction: 'asc' },
    { field: 'lastName', direction: 'asc' }
  ],
  pagination: {
    page: 1,
    limit: 20
  }
};

// Example 2: Complex query with nested logical conditions
export const getActiveUsersWithRolesQuery: QueryOptions = {
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
            value: '%@admin.com'
          },
          {
            operator: 'and',
            conditions: [
              {
                field: 'firstName',
                operator: 'isNotNull'
              },
              {
                field: 'lastName',
                operator: 'isNotNull'
              }
            ]
          }
        ]
      }
    ]
  },
  sort: [
    { field: 'editedAt', direction: 'desc' }
  ]
};

// Example 3: Date range query
export const getRecentProjectsQuery: QueryOptions = {
  select: ['id', 'name', 'description', 'editedAt'],
  filters: {
    operator: 'and',
    conditions: [
      {
        field: 'isDeleted',
        operator: 'eq',
        value: false
      },
      {
        field: 'editedAt',
        operator: 'between',
        values: ['2024-01-01', '2024-12-31']
      }
    ]
  },
  sort: [
    { field: 'editedAt', direction: 'desc' }
  ],
  pagination: {
    page: 1,
    limit: 10
  }
};

// Example 4: IN query with multiple values
export const getUsersByRolesQuery: QueryOptions = {
  filters: {
    operator: 'and',
    conditions: [
      {
        field: 'isDeleted',
        operator: 'eq',
        value: false
      },
      {
        field: 'id',
        operator: 'in',
        values: [1, 2, 3, 4, 5]
      }
    ]
  }
};

// Example 5: CDC table query
export const getCdcUsersQuery: QueryOptions = {
  filters: {
    operator: 'and',
    conditions: [
      {
        field: 'operation',
        operator: 'in',
        values: ['INSERT', 'UPDATE']
      },
      {
        field: 'acknowledge',
        operator: 'eq',
        value: false
      }
    ]
  },
  sort: [
    { field: 'cdc_timestamp', direction: 'desc' }
  ],
  pagination: {
    page: 1,
    limit: 50
  }
};

// Usage examples in a service:
/*
// In any service constructor:
constructor(private dbService: DatabaseService) {}

// Query users table
const usersResult = await this.dbService.executeGenericQuery(
  this.dbService.schema.users,
  getUsersQuery
);

// Query CDC data
const cdcResult = await this.dbService.getCdcTableData(
  this.dbService.schema.users
);

// Custom query
const customResult = await this.dbService.executeGenericQuery(
  this.dbService.schema.projects,
  {
    select: ['id', 'name'],
    filters: {
      operator: 'and',
      conditions: [
        { field: 'isDeleted', operator: 'eq', value: false },
        { field: 'name', operator: 'ilike', value: '%important%' }
      ]
    },
    pagination: { page: 1, limit: 5 }
  }
);

// Access results with full type safety
console.log(usersResult.data[0].email);        // ✅ TypeScript knows this is a string
console.log(usersResult.metadata.executionTime); // ✅ Performance info
console.log(usersResult.pagination?.hasNext);     // ✅ Pagination info
*/