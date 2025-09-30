import { Controller, Get, Post, Put, Delete, Req, Res, UseGuards, Param, Body, HttpException, HttpStatus } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AccessService } from './access.service';
import { AuthGuard } from './guards/auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { CanDeleteUsers, CanEditUsers, CanReadUsers } from './decorators/permissions.decorator';
import { SessionConfig } from './config/session.config';
import { Public } from './decorators/public.decorator';
import { TokenAuthGuard } from './guards/token-auth.guard';
import { PermissionGuard } from './guards/permission.guard';
import { AuthToken } from './decorators/auth-token.decorator';

@ApiTags('Access & Authentication')
@Controller('access')
@UseGuards(AuthGuard, PermissionGuard)
export class AccessController {
    constructor(private readonly accessService: AccessService) { }

    @Public()
    @Get('google')
    @UseGuards(PassportAuthGuard('google'))
    async googleAuth(@Req() req, @Res() res: Response) {
        // Store the user's real IP before redirecting to Google
        const userIpAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || null;
        const userAgent = req.headers['user-agent'] || null;

        // Store IP with a temporary key based on session or generate a unique key
        const tempKey = req.sessionID || `temp_${Date.now()}_${Math.random()}`;
        req.session.tempAuthKey = tempKey;

        if (userIpAddress) {
            this.accessService.storeUserIp(tempKey, userIpAddress, userAgent);
        }

        // Redirects to Google for authentication
    };

    @Public()
    @Get('google/redirect')
    @UseGuards(PassportAuthGuard('google'))
    async googleAuthRedirect(@Req() req, @Res() res: Response) {
        try {
            console.log('Google OAuth callback - req.user:', JSON.stringify(req.user));
            const { token, expiresAt } = await this.accessService.handleGoogleLogin(req);
            res.cookie('token', token, {
                httpOnly: true,    // Prevents XSS attacks
                secure: process.env.NODE_ENV === 'production', // HTTPS only in production
                sameSite: 'lax',   // CSRF protection
                maxAge: SessionConfig.getExpirationMs() // Matches session expiration
            });
            // Add session expiration to cookie for frontend access
            res.cookie('sessionExpiresAt', expiresAt.toISOString(), {
                httpOnly: false,   // Allow frontend access
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: SessionConfig.getExpirationMs()
            });
            res.redirect(process.env.FE_URL + '/dashboard/usuarios');
        } catch (error) {
            console.error('Google OAuth callback error:', error);
            console.error('Full error stack:', error.stack);
            res.status(500).json({ error: error.message });
        }
    };

    @Get('me')
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
    async getProfile(@Req() req) {
        return {
            success: true,
            user: req.user,
            session: {
                id: req.session.id,
                provider: req.session.provider,
                createdAt: req.session.createdAt,
                expiresAt: req.session.expiresAt
            }
        };
    };

    @Get('test-session')
    testSession(@Req() req) {
        req.session.test = 'test-value';
        console.log('Session ID:', req.sessionID);
        return { sessionId: req.sessionID, test: req.session.test };
    }

    @Get('logout')
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Logout current user' })
    @ApiResponse({ status: 200, description: 'Logged out successfully' })
    async logout(@Req() req, @Res() res: Response) {
        const token = req.cookies?.token || req.headers['authorization']?.replace('Bearer ', '');
        await this.accessService.logout(token, req.user.id);

        res.clearCookie('token');
        res.status(200).send({
            success: true,
            message: 'Logged out successfully'
        });
    };

    @Get('users')
    @UseGuards(AuthGuard, PermissionGuard)
@CanReadUsers() // ← Esto es equivalente a @RequirePermissions([{ permission: 'users.read' }])
    @ApiOperation({ summary: 'Get all users' })
    @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
    async getUsers(@Req() req) {
        return {
            success: true,
            data: await this.accessService.getUsers()
        };
    };

    @Get('session-config')
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Get current session configuration' })
    @ApiResponse({ status: 200, description: 'Session configuration retrieved successfully' })
    async getSessionConfig(@Req() req) {
        return {
            success: true,
            data: SessionConfig.getConfig()
        };
    };

    @Get('session/:sessionToken/info')
    @UseGuards(AuthGuard)
    @ApiOperation({
        summary: 'Get detailed session information',
        description: 'Returns session details, user information, and location data from IP address. The sessionToken parameter should be the same token used for authentication.'
    })
    @ApiParam({
        name: 'sessionToken',
        description: 'Session token used for authentication'
    })
    @ApiResponse({
        status: 200,
        description: 'Session information retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                session: {
                    type: 'object',
                    description: 'Session details including status and metadata'
                },
                user: {
                    type: 'object',
                    description: 'Complete user profile information'
                },
                location: {
                    type: 'object',
                    description: 'Geographic location data from IP address'
                },
                metadata: {
                    type: 'object',
                    description: 'Additional metadata like session age and expiration'
                }
            }
        }
    })
    @ApiResponse({
        status: 404,
        description: 'Session not found'
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized - Invalid or expired session'
    })
    async getSessionInfo(@Param('sessionToken') sessionToken: string) {
        try {
            const sessionInfo = await this.accessService.getSessionInfo(sessionToken);
            return {
                success: true,
                data: sessionInfo
            };
        } catch (error) {
            if (error.message.includes('Session not found')) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Session not found',
                        error: 'NOT_FOUND'
                    },
                    HttpStatus.NOT_FOUND
                );
            }

            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to retrieve session information',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    };

    @Get('session/current/info')
    @UseGuards(AuthGuard)
    @ApiOperation({
        summary: 'Get current session information',
        description: 'Returns detailed information for the current authenticated session including user data and location info'
    })
    @ApiResponse({
        status: 200,
        description: 'Current session information retrieved successfully'
    })
    async getCurrentSessionInfo(@Req() req) {
        try {
            // Get token from the request (same logic as SessionAuthGuard)
            const token = req.cookies?.token || req.headers['authorization']?.replace('Bearer ', '');

            if (!token) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'No authentication token found',
                        error: 'NO_TOKEN'
                    },
                    HttpStatus.UNAUTHORIZED
                );
            }

            const sessionInfo = await this.accessService.getSessionInfo(token);
            return {
                success: true,
                data: sessionInfo
            };
        } catch (error) {
            if (error.message.includes('Session not found')) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Current session not found',
                        error: 'SESSION_NOT_FOUND'
                    },
                    HttpStatus.NOT_FOUND
                );
            }

            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to retrieve current session information',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    };

    @Get('activity')
    @UseGuards(AuthGuard)
    @ApiOperation({
        summary: 'Get system activity log',
        description: 'Returns user logins and database changes made by users, leveraging CDC data for comprehensive audit trail'
    })
    @ApiResponse({ status: 200, description: 'Activity log retrieved successfully' })
    async getSystemActivity(@Req() req) {
        try {
            const activityData = await this.accessService.getSystemActivity();
            return {
                success: true,
                data: activityData
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to retrieve system activity',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    };

    @Get('users/:userId/history')
    @UseGuards(AuthGuard, PermissionGuard)
    @CanReadUsers()
    @ApiOperation({
        summary: 'Get specific user change history',
        description: 'Returns change history for a specific user record from CDC data'
    })
    @ApiParam({ name: 'userId', description: 'User ID to get history for' })
    @ApiResponse({ status: 200, description: 'User change history retrieved successfully' })
    async getUserHistory(@Param('userId') userId: string, @Req() req) {
        try {
            const historyData = await this.accessService.getUserHistory(parseInt(userId));
            return {
                success: true,
                data: historyData
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to retrieve user history',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    };

    @Get('users/:userId')
    @UseGuards(AuthGuard, PermissionGuard)
    @CanReadUsers()
    @ApiOperation({
        summary: 'Get specific user details',
        description: 'Returns detailed information for a specific user including roles, permissions, and activity summary'
    })
    @ApiParam({ name: 'userId', description: 'User ID to get details for' })
    @ApiResponse({ status: 200, description: 'User details retrieved successfully' })
    async getUserDetails(@Param('userId') userId: string, @Req() req) {
        try {
            const userDetails = await this.accessService.getUserDetails(parseInt(userId));
            return {
                success: true,
                data: userDetails
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to retrieve user details',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    };

    @Put('users/:userId')
    @UseGuards(AuthGuard, PermissionGuard)
    @CanEditUsers()
    @ApiOperation({
        summary: 'Update user details',
        description: 'Updates a user\'s information including basic profile data'
    })
    @ApiParam({ name: 'userId', description: 'User ID to update' })
    @ApiBody({
        description: 'User data to update',
        schema: {
            type: 'object',
            properties: {
                email: { type: 'string' },
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                alias: { type: 'string' },
                gender: { type: 'string' },
                locale: { type: 'string' },
                phone: { type: 'string' },
                address: { type: 'string' },
                company: { type: 'number' }
            }
        }
    })
    @ApiResponse({ status: 200, description: 'User updated successfully' })
    async updateUser(@Param('userId') userId: string, @Body() updateData: any, @Req() req) {
        try {
            const updatedUser = await this.accessService.updateUser(parseInt(userId), updateData, req.user.id);
            return {
                success: true,
                data: updatedUser
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to update user',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    };

    @Delete('users/:userId')
    @UseGuards(AuthGuard, PermissionGuard)
    @CanDeleteUsers()
    @ApiOperation({
        summary: 'Delete user',
        description: 'Marks a user as deleted (soft delete)'
    })
    @ApiParam({ name: 'userId', description: 'User ID to delete' })
    @ApiResponse({ status: 200, description: 'User deleted successfully' })
    async deleteUser(@Param('userId') userId: string, @Req() req) {
        try {
            const deletedUser = await this.accessService.deleteUser(parseInt(userId), req.user.id);
            return {
                success: true,
                data: deletedUser
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to delete user',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    };

    @Get('activity/user/:userId')
    @UseGuards(AuthGuard)
    @ApiOperation({
        summary: 'Get specific user activity log',
        description: 'Returns activity log for a specific user including logins and database changes'
    })
    @ApiParam({ name: 'userId', description: 'User ID to get activity for' })
    @ApiResponse({ status: 200, description: 'User activity log retrieved successfully' })
    async getUserActivity(@Param('userId') userId: string, @Req() req) {
        try {
            const activityData = await this.accessService.getUserActivity(parseInt(userId));
            return {
                success: true,
                data: activityData
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to retrieve user activity',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    };

    @Post('session/refresh')
    @UseGuards(AuthGuard)
    @ApiOperation({
        summary: 'Refresh/extend current session',
        description: 'Extends the expiration time of the current session'
    })
    @ApiResponse({ status: 200, description: 'Session refreshed successfully' })
    async refreshSession(@Req() req, @Res() res: Response) {
        try {
            const token = req.cookies?.token || req.headers['authorization']?.replace('Bearer ', '');

            if (!token) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'No authentication token found',
                        error: 'NO_TOKEN'
                    },
                    HttpStatus.UNAUTHORIZED
                );
            }

            const result = await this.accessService.refreshSession(token);

            // Refresh the main authentication cookie with new expiration
            res.cookie('token', token, {
                httpOnly: true,    // Prevents XSS attacks
                secure: process.env.NODE_ENV === 'production', // HTTPS only in production
                sameSite: 'lax',   // CSRF protection
                maxAge: SessionConfig.getExpirationMs() // New expiration time
            });

            // Set updated session expiration cookie for frontend
            res.cookie('sessionExpiresAt', result.expiresAt.toISOString(), {
                httpOnly: false,   // Allow frontend access
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: SessionConfig.getExpirationMs()
            });

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to refresh session',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    };

    @Get('session/time-remaining')
    @UseGuards(AuthGuard)
    @ApiOperation({
        summary: 'Get session time remaining',
        description: 'Returns the time remaining in seconds for the current session'
    })
    @ApiResponse({ status: 200, description: 'Time remaining retrieved successfully' })
    async getSessionTimeRemaining(@Req() req) {
        try {
            const token = req.cookies?.token || req.headers['authorization']?.replace('Bearer ', '');

            if (!token) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'No authentication token found',
                        error: 'NO_TOKEN'
                    },
                    HttpStatus.UNAUTHORIZED
                );
            }

            const result = await this.accessService.getSessionTimeRemaining(token);
            return {
                success: true,
                data: result
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to get session time remaining',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    };

    // ======================== PERMISSIONS MANAGEMENT ========================

    @Get('permissions')
    @UseGuards(AuthGuard)
    @ApiOperation({
        summary: 'Get all system permissions',
        description: 'Returns all available permissions in the system with their metadata'
    })
    @ApiResponse({ status: 200, description: 'Permissions retrieved successfully' })
    async getAllPermissions(@Req() req) {
        try {
            // For now, allow any authenticated user to view permissions
            // In production, you might want to add permission check here
            const permissions = await this.accessService.getAllPermissions();
            return {
                success: true,
                data: permissions
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to retrieve permissions',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    };

    @Get('users/:userId/permissions')
    @UseGuards(AuthGuard)
    @ApiOperation({
        summary: 'Get user permissions',
        description: 'Returns all permissions for a specific user from all sources (direct, roles, groups)'
    })
    @ApiParam({ name: 'userId', description: 'User ID to get permissions for' })
    @ApiResponse({ status: 200, description: 'User permissions retrieved successfully' })
    async getUserPermissions(@Param('userId') userId: string, @Req() req) {
        try {
            const permissions = await this.accessService.getUserPermissions(parseInt(userId));
            return {
                success: true,
                data: permissions
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to retrieve user permissions',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    };

    @Get('roles')
    @UseGuards(AuthGuard)
    @ApiOperation({
        summary: 'Get all system roles',
        description: 'Returns all available roles in the system'
    })
    @ApiResponse({ status: 200, description: 'Roles retrieved successfully' })
    async getAllRoles(@Req() req) {
        try {
            const roles = await this.accessService.getAllRoles();
            return {
                success: true,
                data: roles
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to retrieve roles',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    };

    @Post('roles')
    @UseGuards(AuthGuard)
    @ApiOperation({
        summary: 'Create new role',
        description: 'Creates a new role with specified permissions'
    })
    @ApiBody({
        description: 'Role creation data',
        schema: {
            type: 'object',
            required: ['name'],
            properties: {
                name: { type: 'string', description: 'Unique role name' },
                label: { type: 'string', description: 'Display label for the role' },
                description: { type: 'string', description: 'Role description' },
                group: { type: 'string', description: 'Role group/category' },
                permissions: { type: 'array', items: { type: 'string' }, description: 'Array of permission names' }
            }
        }
    })
    @ApiResponse({ status: 201, description: 'Role created successfully' })
    async createRole(@Body() roleData: any, @Req() req) {
        try {
            const role = await this.accessService.createRole(roleData, req.user.id);
            return {
                success: true,
                data: role,
                message: 'Role created successfully'
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to create role',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    };

    @Put('roles/:roleId')
    @UseGuards(AuthGuard)
    @ApiOperation({
        summary: 'Update role',
        description: 'Updates an existing role and its permissions'
    })
    @ApiParam({ name: 'roleId', description: 'Role ID to update' })
    @ApiBody({
        description: 'Role update data',
        schema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Role name' },
                label: { type: 'string', description: 'Display label for the role' },
                description: { type: 'string', description: 'Role description' },
                group: { type: 'string', description: 'Role group/category' },
                permissions: { type: 'array', items: { type: 'string' }, description: 'Array of permission names' }
            }
        }
    })
    @ApiResponse({ status: 200, description: 'Role updated successfully' })
    async updateRole(@Param('roleId') roleId: string, @Body() roleData: any, @Req() req) {
        try {
            const role = await this.accessService.updateRole(parseInt(roleId), roleData, req.user.id);
            return {
                success: true,
                data: role,
                message: 'Role updated successfully'
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to update role',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    };

    @Delete('roles/:roleId')
    @UseGuards(AuthGuard)
    @ApiOperation({
        summary: 'Delete role',
        description: 'Marks a role as deleted (soft delete)'
    })
    @ApiParam({ name: 'roleId', description: 'Role ID to delete' })
    @ApiResponse({ status: 200, description: 'Role deleted successfully' })
    async deleteRole(@Param('roleId') roleId: string, @Req() req) {
        try {
            await this.accessService.deleteRole(parseInt(roleId), req.user.id);
            return {
                success: true,
                message: 'Role deleted successfully'
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to delete role',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    };

    // ======================== SCOPE CONFIGURATION ========================

    @Get('scope/entities')
    @UseGuards(AuthGuard)
    @ApiOperation({
        summary: 'Get scopeable entities configuration',
        description: 'Returns all entities that can be used as permission scopes'
    })
    @ApiResponse({ status: 200, description: 'Scopeable entities retrieved successfully' })
    async getScopeableEntities(@Req() req) {
        try {
            const entities = await this.accessService.getScopeableEntities();
            const settings = await this.accessService.getScopeSettings();
            return {
                success: true,
                data: {
                    entities,
                    settings
                }
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to retrieve scopeable entities',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    };

    @Get('scope/entities/:entityType/instances')
    @UseGuards(AuthGuard)
    @ApiOperation({
        summary: 'Get entity instances for scoping',
        description: 'Returns all available instances of a specific entity type'
    })
    @ApiParam({ name: 'entityType', description: 'Entity type (e.g., company, project)' })
    @ApiResponse({ status: 200, description: 'Entity instances retrieved successfully' })
    async getEntityInstances(@Param('entityType') entityType: string, @Req() req) {
        try {
            const instances = await this.accessService.getEntityInstances(entityType);
            return {
                success: true,
                data: instances
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to retrieve entity instances',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    };

    // ======================== PERMISSION ASSIGNMENT ========================

    @Post('users/:userId/permissions')
    @UseGuards(AuthGuard)
    @ApiOperation({
        summary: 'Assign permission to user',
        description: 'Assigns a permission directly to a user, optionally with scoping'
    })
    @ApiParam({ name: 'userId', description: 'User ID to assign permission to' })
    @ApiBody({
        description: 'Permission assignment data',
        schema: {
            type: 'object',
            required: ['permissionName'],
            properties: {
                permissionName: { type: 'string', description: 'Name of the permission to assign' },
                referenceableType: { type: 'string', description: 'Optional scope type' },
                referenceableId: { type: 'number', description: 'Optional scope ID' }
            }
        }
    })
    @ApiResponse({ status: 201, description: 'Permission assigned successfully' })
    async assignPermissionToUser(
        @Param('userId') userId: string,
        @Body() assignmentData: {
            permissionName: string;
            referenceableType?: string;
            referenceableId?: number
        },
        @Req() req
    ) {
        try {
            await this.accessService.assignPermissionToUser(
                parseInt(userId),
                assignmentData.permissionName,
                req.user.id,
                assignmentData.referenceableType,
                assignmentData.referenceableId
            );
            return {
                success: true,
                message: 'Permission assigned successfully'
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to assign permission',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    };

    @Post('users/:userId/roles')
    @UseGuards(AuthGuard)
    @ApiOperation({
        summary: 'Assign role to user',
        description: 'Assigns a role to a user, optionally with scoping'
    })
    @ApiParam({ name: 'userId', description: 'User ID to assign role to' })
    @ApiBody({
        description: 'Role assignment data',
        schema: {
            type: 'object',
            required: ['roleName'],
            properties: {
                roleName: { type: 'string', description: 'Name of the role to assign' },
                referenceableType: { type: 'string', description: 'Optional scope type' },
                referenceableId: { type: 'number', description: 'Optional scope ID' }
            }
        }
    })
    @ApiResponse({ status: 201, description: 'Role assigned successfully' })
    async assignRoleToUser(
        @Param('userId') userId: string,
        @Body() assignmentData: {
            roleName: string;
            referenceableType?: string;
            referenceableId?: number
        },
        @Req() req
    ) {
        try {
            await this.accessService.assignRoleToUser(
                parseInt(userId),
                assignmentData.roleName,
                req.user.id,
                assignmentData.referenceableType,
                assignmentData.referenceableId
            );
            return {
                success: true,
                message: 'Role assigned successfully'
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to assign role',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    };

    @Delete('users/:userId/permissions/:permissionName')
    @UseGuards(AuthGuard)
    @ApiOperation({
        summary: 'Remove permission from user',
        description: 'Removes a permission assignment from a user'
    })
    @ApiParam({ name: 'userId', description: 'User ID to remove permission from' })
    @ApiParam({ name: 'permissionName', description: 'Name of the permission to remove' })
    @ApiResponse({ status: 200, description: 'Permission removed successfully' })
    async removePermissionFromUser(
        @Param('userId') userId: string,
        @Param('permissionName') permissionName: string,
        @Req() req
    ) {
        try {
            await this.accessService.removePermissionFromUser(
                parseInt(userId),
                permissionName,
                req.user.id
            );
            return {
                success: true,
                message: 'Permission removed successfully'
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to remove permission',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    };

    @Delete('users/:userId/roles/:roleName')
    @UseGuards(AuthGuard)
    @ApiOperation({
        summary: 'Remove role from user',
        description: 'Removes a role assignment from a user'
    })
    @ApiParam({ name: 'userId', description: 'User ID to remove role from' })
    @ApiParam({ name: 'roleName', description: 'Name of the role to remove' })
    @ApiResponse({ status: 200, description: 'Role removed successfully' })
    async removeRoleFromUser(
        @Param('userId') userId: string,
        @Param('roleName') roleName: string,
        @Req() req
    ) {
        try {
            await this.accessService.removeRoleFromUser(
                parseInt(userId),
                roleName,
                req.user.id
            );
            return {
                success: true,
                message: 'Role removed successfully'
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to remove role',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    };
}


