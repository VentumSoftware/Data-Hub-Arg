// src/access/guards/auth.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { DatabaseService } from '../../database/database.service';
import { eq, and, sql, inArray, desc, isNull } from 'drizzle-orm';
import { SessionConfig } from '../config/session.config';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  private db;
  private users;
  private sessions;
  private roles;
  private usersRolesMap;
  private permissions;
  private usersGroups;
  private usersGroupsMap
  private permissionsRolesMap
  constructor(
    private databaseService: DatabaseService,
    private reflector: Reflector // Asegúrate de que esté inyectado
  ) {
    this.db = this.databaseService.db;
    const { users, sessions, roles, usersRolesMap, permissions, usersGroups, usersGroupsMap, permissionsRolesMap } = this.databaseService.schema;
    this.users = users;
    this.sessions = sessions;
    this.roles = roles;

    this.usersRolesMap = usersRolesMap;
    this.usersGroupsMap = usersGroupsMap
    this.permissionsRolesMap = permissionsRolesMap
    this.permissions = permissions;
    this.usersGroups = usersGroups;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {

    /**
     * Update activity and handle session refresh in a single operation
     * @param session - Current session object
     * @param sessionToken - Session token
     */

    const updateActivityAndRefresh = async (session: any, sessionToken: string, req: any): Promise<void> => {
      try {
        // Check if we need to update based on the configured interval
        const lastRefresh = session.refreshedAt ? new Date(session.refreshedAt) : new Date(0);
        const timeSinceLastRefresh = Date.now() - lastRefresh.getTime();

        // Always check for IP updates (temporarily disable throttling)
        if (true || timeSinceLastRefresh > SessionConfig.getUpdateIntervalMs()) {
          // Check if session needs to be refreshed (extended) - DISABLED FOR TESTING
          const shouldRefresh = false; // Disable auto-refresh to test manual modal
          // session.expiresAt && new Date(session.expiresAt).getTime() - Date.now() < SessionConfig.getRefreshThresholdMs();

          // Get current user's real IP address
          const userIpAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || null;
          const userAgent = req.headers['user-agent'] || null;

          // Check if we need to update IP address (if it's currently a Google IP or empty)
          const needsIpUpdate = !session.ipAddress ||
            session.ipAddress.startsWith('172.217.') || // Google IP range
            session.ipAddress.startsWith('74.125.') ||  // Google IP range
            session.ipAddress.startsWith('173.194.') || // Google IP range
            session.ipAddress.startsWith('216.58.');    // Google IP range

          // Prepare update data
          const updateData: any = {
            refreshedAt: new Date(),
            refreshedCount: (session.refreshedCount || 0) + 1
          };

          // Update IP address and user agent if needed
          if (needsIpUpdate && userIpAddress) {
            updateData.ipAddress = userIpAddress;
            updateData.userAgent = userAgent;
          }

          // If session needs refresh, extend expiration
          if (shouldRefresh) {
            updateData.expiresAt = new Date(Date.now() + SessionConfig.getExpirationMs());
          }

          // Single database update for both activity and refresh
          await this.db
            .update(this.sessions)
            .set(updateData)
            .where(eq(this.sessions.token, sessionToken));

          if (shouldRefresh) {
            // Session was auto-refreshed
          }
        }
      } catch (error) {
        // Don't fail auth if update fails
        console.error('⚠️ Failed to update session activity:', error);
      }
    }
    const req = context.switchToHttp().getRequest<Request>();

    // Usar la clave constante del decorador
       // ✅ Si ya fue bypassed por TokenAuthGuard, permitir acceso
    if (req['bypassedByToken'] === true) {
      return true;
    }
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(),]);
    console.log('🔍 isPublic metadata:', !!isPublic);
    if (isPublic) {
      return true;
    }
    const token = req.cookies?.token || req.headers['authorization']?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException({
        success: false,
        message: 'Authentication required',
        error: 'MISSING_TOKEN'
      });
    }

    try {
      // STEP 1: Validate session token directly in database
      const [session] = await this.db
        .select()
        .from(this.sessions)
        .where(eq(this.sessions.token, token));

      if (!session) {
        throw new UnauthorizedException({
          success: false,
          message: 'Session not found',
          error: 'SESSION_NOT_FOUND'
        });
      }

      if (session.revokedAt || session.revokedBy) {
        throw new UnauthorizedException({
          success: false,
          message: 'Session has been revoked',
          error: 'SESSION_REVOKED'
        });
      }

      if (session.expiresAt && new Date() > session.expiresAt) {
        throw new UnauthorizedException({
          success: false,
          message: 'Session has expired',
          error: 'SESSION_EXPIRED'
        });
      }

      // STEP 2: Get user data
      const [user] = await this.db
        .select()
        .from(this.users)
        .where(eq(this.users.id, session.userId));

      if (!user) {
        throw new UnauthorizedException({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        });
      }

      if (user.isDeleted) {
        throw new UnauthorizedException({
          success: false,
          message: 'User account has been deactivated',
          error: 'USER_DEACTIVATED'
        });
      }

      // STEP 3: Update activity and handle session refresh if needed
      await updateActivityAndRefresh(session, token, req);


      // USER DETAILS
      // Obtener roles del usuario
      const userRoles = await this.db.select()
        .from(this.usersRolesMap)
        .leftJoin(this.roles, eq(this.usersRolesMap.roleId, this.roles.id))
        .where(
          and(
            eq(this.usersRolesMap.userId, session.userId),
            eq(this.usersRolesMap.isDeleted, false)
          )
        );

      // Obtener grupos del usuario
      const userGroups = await this.db.select()
        .from(this.usersGroupsMap)
        .leftJoin(this.usersGroups, eq(this.usersGroupsMap.usersGroupId, this.usersGroups.id))
        .where(
          and(
            eq(this.usersGroupsMap.userId, session.userId),
            eq(this.usersGroupsMap.isDeleted, false)
          )
        );

      // Obtener permisos a través de roles
      const rolePermissions = await this.db.select()
        .from(this.permissionsRolesMap)
        .leftJoin(this.permissions, eq(this.permissionsRolesMap.permissionId, this.permissions.id))
        .where(
          and(
            inArray(this.permissionsRolesMap.roleId, userRoles.map(ur => ur.usersRolesMap.roleId)),
            eq(this.permissionsRolesMap.isDeleted, false)
          )
        );
      // Get last session for this user
      const [lastSession] = await this.db
        .select({
          id: this.sessions.id,
          createdAt: this.sessions.createdAt,
          expiresAt: this.sessions.expiresAt,
          ipAddress: this.sessions.ipAddress,
          userAgent: this.sessions.userAgent,
          refreshedAt: this.sessions.refreshedAt,
          revokedAt: this.sessions.revokedAt
        })
        .from(this.sessions)
        .where(eq(this.sessions.userId, session.userId))
        .orderBy(desc(this.sessions.createdAt))
        .limit(1);

      // For now, return basic user data without roles/permissions to avoid table issues
      const roles = userRoles?.map(ur => ur.roles?.name) || [];
      const permissions = rolePermissions?.map(rp => rp.permissions?.name) || [];
      const groups = userGroups?.map(ug => ug.usersGroups?.name) || [];
      // STEP 4: Attach user and session to request
      req['user'] = user;
      req['roles'] = roles;
      req['permissions'] = permissions;
      req['groups'] = groups;
      req['lastSession'] = lastSession;
      req['session'] = session;
      req['sessionToken'] = token;
      req['isAuthenticated'] = true;

      return true;

    } catch (error) {
      // Re-throw UnauthorizedException (from our custom checks)
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Handle any other errors
      console.error('Unexpected auth error:', error);
      throw new UnauthorizedException({
        success: false,
        message: 'Authentication failed',
        error: 'AUTH_ERROR'
      });
    }
  }

}