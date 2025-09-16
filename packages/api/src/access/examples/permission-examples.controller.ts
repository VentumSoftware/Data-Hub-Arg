import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '../guards/auth.guard';
import { PermissionGuard } from '../guards/permission.guard';
import { 
  RequirePermissions, 
  PermissionHelpers,
  CanReadUsers, 
  CanEditUsers,
  RequireAdmin,
  RequireManager,
  UserPermissions,
  UserAttributes,
  CurrentUser
} from '../decorators/permissions.decorator';
import { UserPermission } from '../guards/permission.guard';

@ApiTags('Permission Examples')
@Controller('examples/permissions')
@UseGuards(AuthGuard, PermissionGuard) // Apply both authentication and permission checks
export class PermissionExamplesController {

  // ================== BASIC PERMISSION EXAMPLES ==================

  @Get('basic/global-permission')
  @RequirePermissions([{ permission: 'users.read' }])
  @ApiOperation({ summary: 'Example: Global permission check' })
  async globalPermissionExample() {
    return {
      message: 'You have global users.read permission!',
      type: 'global'
    };
  }

  @Get('basic/quick-decorator')
  @CanReadUsers()
  @ApiOperation({ summary: 'Example: Quick permission decorator' })
  async quickDecoratorExample() {
    return {
      message: 'You can read users!',
      type: 'quick-decorator'
    };
  }

  // ================== SCOPED PERMISSION EXAMPLES ==================

  @Get('scoped/company/:companyId/users')
  @RequirePermissions([
    PermissionHelpers.scoped('users.read', 'company', 'companyId')
  ])
  @ApiOperation({ summary: 'Example: Company-scoped permission' })
  async companyScopedExample(@Param('companyId') companyId: number) {
    return {
      message: `You can read users for company ${companyId}`,
      companyId,
      type: 'scoped-company'
    };
  }

  @Put('scoped/projects/:projectId')
  @RequirePermissions([
    PermissionHelpers.scoped('projects.edit', 'project', 'projectId')
  ])
  @ApiOperation({ summary: 'Example: Project-scoped permission' })
  async projectScopedExample(
    @Param('projectId') projectId: number,
    @Body() updateData: any
  ) {
    return {
      message: `You can edit project ${projectId}`,
      projectId,
      updateData,
      type: 'scoped-project'
    };
  }

  @Post('scoped/dynamic-body')
  @RequirePermissions([
    PermissionHelpers.scopedFromBody('documents.create', 'company', 'companyId')
  ])
  @ApiOperation({ summary: 'Example: Dynamic scope from request body' })
  async dynamicScopeFromBodyExample(@Body() data: { companyId: number; name: string }) {
    return {
      message: `You can create documents for company ${data.companyId}`,
      data,
      type: 'dynamic-body-scope'
    };
  }

  @Get('scoped/query-scope')
  @RequirePermissions([
    PermissionHelpers.scopedFromQuery('reports.read', 'department', 'deptId')
  ])
  @ApiOperation({ summary: 'Example: Dynamic scope from query parameters' })
  async dynamicScopeFromQueryExample() {
    return {
      message: 'You can read reports for the specified department',
      type: 'dynamic-query-scope'
    };
  }

  // ================== ABAC (ATTRIBUTE-BASED) EXAMPLES ==================

  @Get('abac/admin-only')
  @RequireAdmin()
  @ApiOperation({ summary: 'Example: Admin-only access with attributes' })
  async adminOnlyExample(@UserAttributes() attributes: any) {
    return {
      message: 'Welcome, admin!',
      userAttributes: attributes,
      type: 'abac-admin'
    };
  }

  @Get('abac/manager-level')
  @RequireManager()
  @ApiOperation({ summary: 'Example: Manager level access' })
  async managerLevelExample(@UserAttributes() attributes: any) {
    return {
      message: 'Welcome, manager or higher!',
      userAttributes: attributes,
      type: 'abac-manager'
    };
  }

  @Delete('abac/hr-only/:userId')
  @RequirePermissions([{
    permission: 'users.delete',
    attributes: { 
      department: 'HR', 
      clearanceLevel: ['L3', 'L4', 'L5'] 
    }
  }])
  @ApiOperation({ summary: 'Example: HR department with high clearance only' })
  async hrHighClearanceExample(
    @Param('userId') userId: number,
    @UserAttributes() attributes: any
  ) {
    return {
      message: `HR user with high clearance can delete user ${userId}`,
      userId,
      userAttributes: attributes,
      type: 'abac-hr-clearance'
    };
  }

  // ================== MULTIPLE PERMISSION EXAMPLES ==================

  @Post('multiple/all-required')
  @RequirePermissions([
    { permission: 'users.read' },
    { permission: 'users.edit' },
    PermissionHelpers.scoped('company.access', 'company', 'companyId')
  ])
  @ApiOperation({ summary: 'Example: Multiple permissions (ALL required)' })
  async multiplePermissionsAllExample(@Body() data: { companyId: number }) {
    return {
      message: 'You have all required permissions!',
      data,
      type: 'multiple-all-required'
    };
  }

  // ================== COMPLEX HYBRID EXAMPLES ==================

  @Put('complex/scoped-with-attributes/:companyId/users/:userId')
  @RequirePermissions([{
    permission: 'users.edit',
    scope: {
      type: 'company',
      dynamicId: 'params.companyId'
    },
    attributes: {
      department: ['HR', 'Management'],
      level: ['manager', 'director', 'admin']
    }
  }])
  @ApiOperation({ summary: 'Example: Complex scoped permission with attributes' })
  async complexHybridExample(
    @Param('companyId') companyId: number,
    @Param('userId') userId: number,
    @Body() updateData: any,
    @UserAttributes() attributes: any,
    @UserPermissions() permissions: UserPermission[]
  ) {
    return {
      message: `HR/Management user with manager+ level can edit user ${userId} in company ${companyId}`,
      companyId,
      userId,
      updateData,
      userAttributes: attributes,
      userPermissions: permissions,
      type: 'complex-hybrid'
    };
  }

  // ================== DEBUGGING AND INTROSPECTION ==================

  @Get('debug/my-permissions')
  @RequirePermissions([{ permission: 'users.read' }]) // Minimal permission to access
  @ApiOperation({ summary: 'Example: View your effective permissions' })
  async debugMyPermissions(
    @CurrentUser() user: any,
    @UserPermissions() permissions: UserPermission[],
    @UserAttributes() attributes: any
  ) {
    return {
      message: 'Your effective permissions',
      user: {
        id: user.id,
        email: user.email,
        alias: user.alias
      },
      permissions: permissions.map(p => ({
        permission: p.permission,
        scope: p.scope,
        source: p.source,
        sourceName: p.sourceName
      })),
      attributes,
      permissionCount: permissions.length,
      type: 'debug-permissions'
    };
  }

  @Get('debug/permission-analysis')
  @RequirePermissions([{ permission: 'admin.system.analysis' }])
  @ApiOperation({ summary: 'Example: Analyze permission sources (admin only)' })
  async debugPermissionAnalysis(
    @UserPermissions() permissions: UserPermission[]
  ) {
    const analysis = {
      total: permissions.length,
      bySource: {
        direct: permissions.filter(p => p.source === 'direct').length,
        role: permissions.filter(p => p.source === 'role').length,
        group: permissions.filter(p => p.source === 'group').length,
      },
      scopedPermissions: permissions.filter(p => p.scope).length,
      globalPermissions: permissions.filter(p => !p.scope).length,
      uniquePermissions: [...new Set(permissions.map(p => p.permission))].length,
      scopes: [...new Set(
        permissions
          .filter(p => p.scope)
          .map(p => p.scope.type)
      )],
      permissions: permissions.map(p => ({
        permission: p.permission,
        scope: p.scope,
        source: `${p.source}:${p.sourceName}`,
      }))
    };

    return {
      message: 'Permission system analysis',
      analysis,
      type: 'debug-analysis'
    };
  }
}