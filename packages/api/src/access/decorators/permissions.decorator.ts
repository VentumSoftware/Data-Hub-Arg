// src/access/decorators/permissions.decorator.ts
import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PermissionCheck } from '../guards/permission.guard';

/**
 * Decorator to require specific permissions on an endpoint
 * 
 * @example
 * // Require global permission
 * @RequirePermissions([{ permission: 'users.read' }])
 * 
 * // Require scoped permission with static scope
 * @RequirePermissions([{ 
 *   permission: 'projects.edit', 
 *   scope: { type: 'company', id: 123 } 
 * }])
 * 
 * // Require scoped permission with dynamic scope from request
 * @RequirePermissions([{ 
 *   permission: 'projects.edit', 
 *   scope: { type: 'company', dynamicId: 'params.companyId' } 
 * }])
 * 
 * // Require permission with ABAC attributes
 * @RequirePermissions([{ 
 *   permission: 'users.delete', 
 *   attributes: { department: 'HR', clearanceLevel: ['L3', 'L4'] } 
 * }])
 * 
 * // Multiple permissions (ALL required)
 * @RequirePermissions([
 *   { permission: 'users.read' },
 *   { permission: 'users.edit', scope: { type: 'company', dynamicId: 'params.companyId' } }
 * ])
 */
export const RequirePermissions = (permissions: PermissionCheck[]) => 
  SetMetadata('permissions', permissions);

/**
 * Decorator to require any of the specified permissions (OR logic)
 */
export const RequireAnyPermission = (permissions: PermissionCheck[]) =>
  SetMetadata('permissions', permissions.map(p => ({ ...p, operator: 'OR' })));

/**
 * Common permission helpers
 */
export class PermissionHelpers {
  /**
   * Create a scoped permission check with dynamic ID from request params
   */
  static scoped(permission: string, scopeType: string, paramName: string = 'id'): PermissionCheck {
    return {
      permission,
      scope: {
        type: scopeType,
        dynamicId: `params.${paramName}`
      }
    };
  }

  /**
   * Create a permission check with body-based dynamic scope
   */
  static scopedFromBody(permission: string, scopeType: string, bodyField: string): PermissionCheck {
    return {
      permission,
      scope: {
        type: scopeType,
        dynamicId: `body.${bodyField}`
      }
    };
  }

  /**
   * Create a permission check with query-based dynamic scope
   */
  static scopedFromQuery(permission: string, scopeType: string, queryParam: string): PermissionCheck {
    return {
      permission,
      scope: {
        type: scopeType,
        dynamicId: `query.${queryParam}`
      }
    };
  }

  /**
   * Create an attribute-based permission check
   */
  static withAttributes(permission: string, attributes: Record<string, any>): PermissionCheck {
    return {
      permission,
      attributes
    };
  }

  /**
   * Create a fully scoped and attributed permission check
   */
  static full(
    permission: string, 
    scopeType: string, 
    scopeId: string | number, 
    attributes?: Record<string, any>
  ): PermissionCheck {
    return {
      permission,
      scope: {
        type: scopeType,
        id: scopeId
      },
      attributes
    };
  }
}

/**
 * Quick permission decorators for common patterns
 */

// User management permissions
export const CanReadUsers = () => RequirePermissions([{ permission: 'users.read' }]);
export const CanEditUsers = () => RequirePermissions([{ permission: 'users.edit' }]);
export const CanDeleteUsers = () => RequirePermissions([{ permission: 'users.delete' }]);
export const CanCreateUsers = () => RequirePermissions([{ permission: 'users.create' }]);

// Company-scoped permissions
export const CanReadCompanyUsers = () => RequirePermissions([
  PermissionHelpers.scoped('users.read', 'company', 'companyId')
]);

export const CanEditCompanyUsers = () => RequirePermissions([
  PermissionHelpers.scoped('users.edit', 'company', 'companyId')
]);

// Project-scoped permissions
export const CanReadProject = () => RequirePermissions([
  PermissionHelpers.scoped('projects.read', 'project', 'projectId')
]);

export const CanEditProject = () => RequirePermissions([
  PermissionHelpers.scoped('projects.edit', 'project', 'projectId')
]);

// Admin permissions with attributes
export const RequireAdmin = () => RequirePermissions([{
  permission: 'admin.access',
  attributes: { role: 'admin' }
}]);

export const RequireManager = () => RequirePermissions([{
  permission: 'management.access',
  attributes: { level: ['manager', 'director', 'admin'] }
}]);

/**
 * Utility decorators to extract user data in controllers
 */

export const UserPermissions = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.userPermissions;
  },
);

export const UserAttributes = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.userAttributes;
  },
);

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);