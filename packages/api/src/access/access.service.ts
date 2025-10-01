import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { eq, desc, sql, and } from 'drizzle-orm';
import { IpApiService, LocationInfo } from './services/ip-api.service';
import { PermissionsService } from './services/permissions.service';
import { ScopeConfigService } from './services/scope-config.service';
import { randomBytes } from 'crypto';
import { SessionConfig } from './config/session.config';

@Injectable()
export class AccessService {

  private db;
  private users;
  private sessions;
  private roles;
  private usersRolesMap;
  private tempUserIpStore = new Map<string, { ip: string, userAgent: string, timestamp: number }>();

  constructor(
    private databaseService: DatabaseService,
    private ipApiService: IpApiService,
    private permissionsService: PermissionsService,
    private scopeConfigService: ScopeConfigService
  ) {
    this.db = this.databaseService.db;
    const { users, sessions, roles, usersRolesMap } = this.databaseService.schema;
    this.users = users;
    this.sessions = sessions;
    this.roles = roles;
    this.usersRolesMap = usersRolesMap;
    
    // Clean up old entries every 10 minutes
    setInterval(() => {
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      for (const [key, value] of this.tempUserIpStore.entries()) {
        if (value.timestamp < fiveMinutesAgo) {
          this.tempUserIpStore.delete(key);
        }
      }
    }, 10 * 60 * 1000);
  }

  // Store user's real IP before OAuth redirect
  storeUserIp(email: string, ip: string, userAgent: string) {
    this.tempUserIpStore.set(email, {
      ip,
      userAgent,
      timestamp: Date.now()
    });
  }

  // Retrieve and remove user's real IP after OAuth callback
  retrieveUserIp(email: string): { ip: string, userAgent: string } | null {
    const data = this.tempUserIpStore.get(email);
    if (data) {
      this.tempUserIpStore.delete(email);
      return { ip: data.ip, userAgent: data.userAgent };
    }
    return null;
  }

  async handleGoogleLogin(req: any) {
    const userData = req.user;
    let [user] = await this.db.select().from(this.users).where(eq(this.users.email, userData.email));
    console.log('User lookup result:', { user, userId: user?.id, userIdType: typeof user?.id });
    if (!user) {
      [user] = await this.db.insert(this.users).values({
        email: userData.email,
        firstName: userData.givenName,
        lastName: userData.familyName,
        alias: userData.displayName,
        profilePicture: userData.picture,
        isDeleted: false,
        editedAt: new Date(),
        editedBy: 1,
      }).returning();
      // Hay que darle un rol "guest" por default
      //const roleUser = await this.db.select().from(this.roles).where(eq(this.roles.name, 'guest'));
       const roleUser = await this.db.select().from(this.roles).where(eq(this.roles.name, 'admin'));
      await this.db.insert(this.usersRolesMap).values({
        userId: user.id,
        roleId: roleUser[0].id,
        isDeleted: false,
        editedAt: new Date(),
        editedBy: 1,
      });
      

    }

    // Generate a secure random session token (64 chars)
    const sessionToken = randomBytes(32).toString('hex');
    
    // Use centralized session configuration
    const expiresAt = new Date(Date.now() + SessionConfig.getExpirationMs());

    // Try to get the stored real IP first, fallback to request IP
    const storedIpData = this.retrieveUserIp(userData.email);
    const ipAddress = storedIpData?.ip || req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || null;
    const userAgent = storedIpData?.userAgent || req.headers['user-agent'] || null;

    const sessionData = {
      userId: parseInt(user.id),
      provider: 'google',
      externalId: String(userData.id || userData.googleId || ''),
      token: sessionToken, // Store the session token directly
      createdAt: new Date(),
      expiresAt: expiresAt,
      ipAddress: ipAddress,
      userAgent: userAgent,
    };
    
    await this.db.insert(this.sessions).values(sessionData);

    return { 
      token: sessionToken,
      expiresAt: expiresAt
    };
  }
  
  async logout(token: string, userId: number) {
    await this.databaseService.db
      .update(this.sessions)
      .set({ revokedBy: userId, revokedAt: new Date() })
      .where(eq(this.sessions.token, token));
  }

  async getUsers() {
    // Get all users with their basic information
    const users = await this.db.select().from(this.users);
    
    // For each user, get their last session and add mock data for roles/permissions for now
    const enhancedUsers = await Promise.all(
      users.map(async (user) => {
        // Get last session for this user (most recent first)
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
          .where(eq(this.sessions.userId, user.id))
          .orderBy(desc(this.sessions.createdAt))
          .limit(1);

        // Get user roles using raw SQL (due to table name case sensitivity)
        const userRolesQuery = sql`
          SELECT r.id, r.name, r.label, r.role_group, r.description
          FROM roles r
          JOIN "usersRolesMap" urm ON r.id = urm.role_id
          WHERE urm.user_id = ${user.id} AND urm.is_deleted = false
        `;
        const userRoles = await this.db.execute(userRolesQuery);

        // Get user permissions (both direct and through roles) using raw SQL
        const userPermissionsQuery = sql`
          SELECT DISTINCT p.id, p.name, p.label, p.permission_group, p.description
          FROM permissions p
          WHERE p.id IN (
            -- Direct user permissions
            SELECT pum.permission_id
            FROM "permissionsUsersMap" pum
            WHERE pum.user_id = ${user.id} AND pum.is_deleted = false
            
            UNION
            
            -- Permissions through roles
            SELECT prm.permission_id
            FROM "permissionsRolesMap" prm
            JOIN "usersRolesMap" urm ON prm.role_id = urm.role_id
            WHERE urm.user_id = ${user.id} AND urm.is_deleted = false AND prm.is_deleted = false
          )
        `;
        const userPermissions = await this.db.execute(userPermissionsQuery);

        const roles = userRoles.rows.map(row => ({
          id: row.id,
          name: row.name,
          label: row.label || row.name,
          group: row.role_group,
          description: row.description
        }));

        const permissions = userPermissions.rows.map(row => ({
          id: row.id,
          name: row.name,
          label: row.label || row.name,
          group: row.permission_group,
          description: row.description
        }));

        // Calculate the actual last activity time (most recent of createdAt or refreshedAt)
        const lastActivityDate = lastSession ? 
          (lastSession.refreshedAt && new Date(lastSession.refreshedAt) > new Date(lastSession.createdAt) 
            ? lastSession.refreshedAt 
            : lastSession.createdAt) 
          : null;

        return {
          ...user,
          roles,
          permissions,
          lastSession: lastSession || null,
          // Add computed fields
          rolesCount: roles.length,
          permissionsCount: permissions.length,
          lastSessionDate: lastActivityDate, // Use actual last activity time
          isOnline: lastSession && !lastSession.revokedAt && lastSession.expiresAt && new Date() < new Date(lastSession.expiresAt)
        };
      })
    );

    return enhancedUsers;
  }

  /**
   * Get detailed information for a specific user
   * @param userId - User ID to get details for
   * @returns Promise with user details including roles, permissions, and groups
   */
  async getUserDetails(userId: number) {
    try {
      // Get the user basic information
      const [user] = await this.db
        .select()
        .from(this.users)
        .where(eq(this.users.id, userId));

      if (!user) {
        throw new Error('User not found');
      }

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
        .where(eq(this.sessions.userId, userId))
        .orderBy(desc(this.sessions.createdAt))
        .limit(1);

      // For now, return basic user data without roles/permissions to avoid table issues
      const roles = [];
      const permissions = [];
      const groups = [];

      // Calculate the actual last activity time
      const lastActivityDate = lastSession ? 
        (lastSession.refreshedAt && new Date(lastSession.refreshedAt) > new Date(lastSession.createdAt) 
          ? lastSession.refreshedAt 
          : lastSession.createdAt) 
        : null;

      return {
        user: {
          ...user,
          lastSession: lastSession || null,
          lastSessionDate: lastActivityDate,
          isOnline: lastSession && !lastSession.revokedAt && lastSession.expiresAt && new Date() < new Date(lastSession.expiresAt)
        },
        roles,
        permissions,
        groups,
        summary: {
          rolesCount: roles.length,
          permissionsCount: permissions.length,
          groupsCount: groups.length,
          lastActivity: lastActivityDate,
          isActive: !user.isDeleted
        }
      };

    } catch (error) {
      console.error('Failed to get user details:', error);
      throw new Error(`Failed to retrieve user details: ${error.message}`);
    }
  }

  /**
   * Update user information
   * @param userId - User ID to update
   * @param updateData - Data to update
   * @param editorUserId - ID of the user making the update
   * @returns Promise with updated user data
   */
  async updateUser(userId: number, updateData: any, editorUserId: number) {
    try {
      // Check if user exists
      const [existingUser] = await this.db
        .select()
        .from(this.users)
        .where(eq(this.users.id, userId));

      if (!existingUser) {
        throw new Error('User not found');
      }

      // Convert camelCase fields to snake_case for database
      const convertedData: any = {};
      
      if (updateData.firstName) convertedData.first_name = updateData.firstName;
      if (updateData.lastName) convertedData.last_name = updateData.lastName;
      if (updateData.profilePicture) convertedData.profile_picture = updateData.profilePicture;
      
      // Direct mapping for fields that match
      if (updateData.email) convertedData.email = updateData.email;
      if (updateData.alias) convertedData.alias = updateData.alias;
      if (updateData.gender) convertedData.gender = updateData.gender;
      if (updateData.locale) convertedData.locale = updateData.locale;
      if (updateData.phone) convertedData.phone = updateData.phone;
      if (updateData.address) convertedData.address = updateData.address;
      if (updateData.company) convertedData.company = updateData.company;
      if (updateData.bio) convertedData.bio = updateData.bio;
      if (updateData.location) convertedData.location = updateData.location;
      if (updateData.timezone) convertedData.timezone = updateData.timezone;
      if (updateData.url) convertedData.url = updateData.url;

      // Prepare update data with audit fields
      const updatedData = {
        ...convertedData,
        editedAt: new Date(),
        editedBy: editorUserId
      };

      // Update the user
      const [updatedUser] = await this.db
        .update(this.users)
        .set(updatedData)
        .where(eq(this.users.id, userId))
        .returning();

      return updatedUser;

    } catch (error) {
      console.error('Failed to update user:', error);
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  /**
   * Delete user (soft delete)
   * @param userId - User ID to delete
   * @param editorUserId - ID of the user performing the deletion
   * @returns Promise with deleted user data
   */
  async deleteUser(userId: number, editorUserId: number) {
    try {
      // Check if user exists
      const [existingUser] = await this.db
        .select()
        .from(this.users)
        .where(eq(this.users.id, userId));

      if (!existingUser) {
        throw new Error('User not found');
      }

      // Soft delete the user
      const [deletedUser] = await this.db
        .update(this.users)
        .set({
          isDeleted: true,
          editedAt: new Date(),
          editedBy: editorUserId
        })
        .where(eq(this.users.id, userId))
        .returning();

      // Also revoke all active sessions for this user
      await this.db
        .update(this.sessions)
        .set({
          revokedBy: editorUserId,
          revokedAt: new Date()
        })
        .where(eq(this.sessions.userId, userId));

      return deletedUser;

    } catch (error) {
      console.error('Failed to delete user:', error);
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  /**
   * Get detailed session information including user data and location info
   * @param sessionToken - Session token (can be session ID or token)
   * @returns Session info with user data and location information
   */
  async getSessionInfo(sessionToken: string) {
    try {
      // First, get the session with user data
      const [sessionResult] = await this.db
        .select({
          // Session fields
          sessionId: this.sessions.id,
          sessionToken: this.sessions.token,
          userId: this.sessions.userId,
          provider: this.sessions.provider,
          externalId: this.sessions.externalId,
          createdAt: this.sessions.createdAt,
          expiresAt: this.sessions.expiresAt,
          ipAddress: this.sessions.ipAddress,
          userAgent: this.sessions.userAgent,
          deviceInfo: this.sessions.deviceInfo,
          geoLocation: this.sessions.geoLocation,
          refreshedCount: this.sessions.refreshedCount,
          refreshedAt: this.sessions.refreshedAt,
          revokedAt: this.sessions.revokedAt,
          revokedBy: this.sessions.revokedBy,
          // User fields
          userEmail: this.users.email,
          userAlias: this.users.alias,
          userFirstName: this.users.firstName,
          userLastName: this.users.lastName,
          userProfilePicture: this.users.profilePicture,
          userUrl: this.users.url,
          userBio: this.users.bio,
          userBirthday: this.users.birthday,
          userGender: this.users.gender,
          userLocale: this.users.locale,
          userTimezone: this.users.timezone,
          userLocation: this.users.location,
          userPhone: this.users.phone,
          userAddress: this.users.address,
          userCompany: this.users.company,
          userIsDeleted: this.users.isDeleted,
          userEditedAt: this.users.editedAt,
          userEditedBy: this.users.editedBy
        })
        .from(this.sessions)
        .innerJoin(this.users, eq(this.sessions.userId, this.users.id))
        .where(eq(this.sessions.token, sessionToken));

      if (!sessionResult) {
        throw new Error('Session not found');
      }

      // Get location information if IP address is available
      let locationInfo: LocationInfo | null = null;
      if (sessionResult.ipAddress) {
        locationInfo = await this.ipApiService.getLocationInfo(sessionResult.ipAddress);
      }

      // Format the response
      return {
        session: {
          id: sessionResult.sessionId,
          token: sessionResult.sessionToken,
          userId: sessionResult.userId,
          provider: sessionResult.provider,
          externalId: sessionResult.externalId,
          createdAt: sessionResult.createdAt,
          expiresAt: sessionResult.expiresAt,
          ipAddress: sessionResult.ipAddress,
          userAgent: sessionResult.userAgent,
          deviceInfo: sessionResult.deviceInfo,
          geoLocation: sessionResult.geoLocation,
          refreshedCount: sessionResult.refreshedCount,
          refreshedAt: sessionResult.refreshedAt,
          revokedAt: sessionResult.revokedAt,
          revokedBy: sessionResult.revokedBy,
          isActive: !sessionResult.revokedAt && new Date() < new Date(sessionResult.expiresAt),
          isExpired: new Date() >= new Date(sessionResult.expiresAt)
        },
        user: {
          id: sessionResult.userId,
          email: sessionResult.userEmail,
          alias: sessionResult.userAlias,
          firstName: sessionResult.userFirstName,
          lastName: sessionResult.userLastName,
          fullName: `${sessionResult.userFirstName || ''} ${sessionResult.userLastName || ''}`.trim(),
          profilePicture: sessionResult.userProfilePicture,
          url: sessionResult.userUrl,
          bio: sessionResult.userBio,
          birthday: sessionResult.userBirthday,
          gender: sessionResult.userGender,
          locale: sessionResult.userLocale,
          timezone: sessionResult.userTimezone,
          location: sessionResult.userLocation,
          phone: sessionResult.userPhone,
          address: sessionResult.userAddress,
          company: sessionResult.userCompany,
          isDeleted: sessionResult.userIsDeleted,
          editedAt: sessionResult.userEditedAt,
          editedBy: sessionResult.userEditedBy
        },
        location: locationInfo,
        metadata: {
          fetchedAt: new Date(),
          hasLocationData: !!locationInfo?.isValid,
          sessionAge: sessionResult.createdAt ? 
            Math.floor((Date.now() - new Date(sessionResult.createdAt).getTime()) / 1000) : null,
          timeToExpiration: sessionResult.expiresAt ? 
            Math.floor((new Date(sessionResult.expiresAt).getTime() - Date.now()) / 1000) : null
        }
      };

    } catch (error) {
      console.error('Failed to get session info:', error);
      throw new Error(`Failed to retrieve session information: ${error.message}`);
    }
  }

  /**
   * Get system-wide activity log combining logins and CDC data
   * @returns Promise with activity log including logins and database changes
   */
  async getSystemActivity() {
    try {
      // Get recent logins (session creations)
      const recentLogins = await this.db.execute(sql`
        SELECT 
          'LOGIN' as activity_type,
          s.created_at as activity_time,
          s.user_id,
          u.email,
          u.first_name,
          u.last_name,
          s.provider,
          s.ip_address,
          s.user_agent,
          NULL as table_name,
          NULL as operation,
          NULL as changed_data,
          NULL as revoked_by
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.created_at >= NOW() - INTERVAL '7 days'
        ORDER BY s.created_at DESC
        LIMIT 50
      `);

      // Get recent logouts/revocations (session revocations)
      const recentLogouts = await this.db.execute(sql`
        SELECT 
          CASE 
            WHEN s.revoked_by = s.user_id THEN 'LOGOUT'
            ELSE 'KICKED_OUT'
          END as activity_type,
          s.revoked_at as activity_time,
          s.user_id,
          u.email,
          u.first_name,
          u.last_name,
          s.provider,
          s.ip_address,
          s.user_agent,
          NULL as table_name,
          NULL as operation,
          NULL as changed_data,
          s.revoked_by,
          ru.email as revoked_by_email,
          ru.first_name as revoked_by_first_name,
          ru.last_name as revoked_by_last_name
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN users ru ON s.revoked_by = ru.id
        WHERE s.revoked_at IS NOT NULL 
          AND s.revoked_at >= NOW() - INTERVAL '7 days'
        ORDER BY s.revoked_at DESC
        LIMIT 50
      `);

      // Get recent database changes from all CDC tables
      const recentChanges = await this.db.execute(sql`
        -- Changes from users table
        SELECT 
          'DATABASE_CHANGE' as activity_type,
          c._cdc_timestamp as activity_time,
          CAST(c.edited_by AS INTEGER) as user_id,
          u.email,
          u.first_name,
          u.last_name,
          NULL as provider,
          NULL as ip_address,
          NULL as user_agent,
          'users' as table_name,
          c._cdc_operation as operation,
          row_to_json(c.*) as changed_data
        FROM _cdc_users c
        LEFT JOIN users u ON c.edited_by = u.id
        WHERE c._cdc_timestamp >= NOW() - INTERVAL '7 days'
          AND c.edited_by IS NOT NULL
          AND c.edited_by > 0

        UNION ALL

        -- Changes from projects table  
        SELECT 
          'DATABASE_CHANGE' as activity_type,
          c._cdc_timestamp as activity_time,
          CAST(c.edited_by AS INTEGER) as user_id,
          u.email,
          u.first_name,
          u.last_name,
          NULL as provider,
          NULL as ip_address,
          NULL as user_agent,
          'projects' as table_name,
          c._cdc_operation as operation,
          row_to_json(c.*) as changed_data
        FROM _cdc_projects c
        LEFT JOIN users u ON c.edited_by = u.id
        WHERE c._cdc_timestamp >= NOW() - INTERVAL '7 days'
          AND c.edited_by IS NOT NULL
          AND c.edited_by > 0

        UNION ALL

        -- Changes from roles table
        SELECT 
          'DATABASE_CHANGE' as activity_type,
          c._cdc_timestamp as activity_time,
          CAST(c.edited_by AS INTEGER) as user_id,
          u.email,
          u.first_name,
          u.last_name,
          NULL as provider,
          NULL as ip_address,
          NULL as user_agent,
          'roles' as table_name,
          c._cdc_operation as operation,
          row_to_json(c.*) as changed_data
        FROM _cdc_roles c
        LEFT JOIN users u ON c.edited_by = u.id
        WHERE c._cdc_timestamp >= NOW() - INTERVAL '7 days'
          AND c.edited_by IS NOT NULL
          AND c.edited_by > 0

        ORDER BY activity_time DESC
        LIMIT 100
      `);

      // Combine and sort all activities
      const allActivities = [
        ...recentLogins.rows.map(row => ({
          type: row.activity_type,
          timestamp: row.activity_time,
          user: {
            id: row.user_id,
            email: row.email,
            firstName: row.first_name,
            lastName: row.last_name,
            fullName: `${row.first_name || ''} ${row.last_name || ''}`.trim()
          },
          details: {
            provider: row.provider,
            ipAddress: row.ip_address,
            userAgent: row.user_agent
          }
        })),
        ...recentLogouts.rows.map(row => ({
          type: row.activity_type,
          timestamp: row.activity_time,
          user: {
            id: row.user_id,
            email: row.email,
            firstName: row.first_name,
            lastName: row.last_name,
            fullName: `${row.first_name || ''} ${row.last_name || ''}`.trim()
          },
          details: {
            provider: row.provider,
            ipAddress: row.ip_address,
            userAgent: row.user_agent,
            revokedBy: row.revoked_by,
            revokedByUser: row.revoked_by ? {
              email: row.revoked_by_email,
              firstName: row.revoked_by_first_name,
              lastName: row.revoked_by_last_name,
              fullName: `${row.revoked_by_first_name || ''} ${row.revoked_by_last_name || ''}`.trim()
            } : null
          }
        })),
        ...recentChanges.rows.map(row => ({
          type: row.activity_type,
          timestamp: row.activity_time,
          user: {
            id: row.user_id,
            email: row.email,
            firstName: row.first_name,
            lastName: row.last_name,
            fullName: `${row.first_name || ''} ${row.last_name || ''}`.trim()
          },
          details: {
            tableName: row.table_name,
            operation: row.operation,
            changedData: row.changed_data
          }
        }))
      ];

      // Sort by timestamp descending
      allActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return {
        activities: allActivities.slice(0, 100), // Limit to most recent 100
        summary: {
          totalActivities: allActivities.length,
          uniqueUsers: [...new Set(allActivities.map(a => a.user.id))].length,
          timeRange: '7 days'
        }
      };

    } catch (error) {
      console.error('Failed to get system activity:', error);
      throw new Error(`Failed to retrieve system activity: ${error.message}`);
    }
  }

  /**
   * Refresh/extend an existing session
   * @param token - Session token to refresh
   * @returns Promise with updated session info
   */
  async refreshSession(token: string) {
    try {
      // Find the session
      const [session] = await this.db
        .select()
        .from(this.sessions)
        .where(eq(this.sessions.token, token));

      if (!session) {
        throw new Error('Session not found');
      }

      // Check if session is already revoked
      if (session.revokedAt) {
        throw new Error('Session has been revoked');
      }

      // Check if session has expired
      if (new Date() >= new Date(session.expiresAt)) {
        throw new Error('Session has expired');
      }

      // Extend the session by the configured duration
      const newExpiresAt = new Date(Date.now() + SessionConfig.getExpirationMs());
      
      // Update the session
      const [updatedSession] = await this.db
        .update(this.sessions)
        .set({
          expiresAt: newExpiresAt,
          refreshedAt: new Date(),
          refreshedCount: (session.refreshedCount || 0) + 1
        })
        .where(eq(this.sessions.token, token))
        .returning();

      return {
        success: true,
        expiresAt: updatedSession.expiresAt,
        refreshedAt: updatedSession.refreshedAt,
        refreshedCount: updatedSession.refreshedCount
      };

    } catch (error) {
      console.error('Failed to refresh session:', error);
      throw new Error(`Failed to refresh session: ${error.message}`);
    }
  }

  /**
   * Get session time remaining
   * @param token - Session token
   * @returns Time remaining in seconds
   */
  async getSessionTimeRemaining(token: string) {
    try {
      const [session] = await this.db
        .select({
          expiresAt: this.sessions.expiresAt,
          revokedAt: this.sessions.revokedAt
        })
        .from(this.sessions)
        .where(eq(this.sessions.token, token));

      if (!session) {
        return { timeRemaining: 0, isExpired: true };
      }

      if (session.revokedAt) {
        return { timeRemaining: 0, isExpired: true };
      }

      const now = Date.now();
      const expiresAt = new Date(session.expiresAt).getTime();
      const timeRemaining = Math.max(0, Math.floor((expiresAt - now) / 1000));

      return {
        timeRemaining,
        isExpired: timeRemaining === 0,
        expiresAt: session.expiresAt
      };

    } catch (error) {
      console.error('Failed to get session time remaining:', error);
      return { timeRemaining: 0, isExpired: true };
    }
  }

  /**
   * Get activity log for a specific user
   * @param userId - User ID to get activity for
   * @returns Promise with user's activity log
   */
  async getUserActivity(userId: number) {
    try {
      // Get user's logins
      const userLogins = await this.db.execute(sql`
        SELECT 
          'LOGIN' as activity_type,
          s.created_at as activity_time,
          s.provider,
          s.ip_address,
          s.user_agent,
          s.expires_at,
          s.revoked_at,
          NULL as table_name,
          NULL as operation,
          NULL as changed_data,
          NULL as revoked_by
        FROM sessions s
        WHERE s.user_id = ${userId}
        ORDER BY s.created_at DESC
        LIMIT 50
      `);

      // Get user's logouts/revocations
      const userLogouts = await this.db.execute(sql`
        SELECT 
          CASE 
            WHEN s.revoked_by = s.user_id THEN 'LOGOUT'
            ELSE 'KICKED_OUT'
          END as activity_type,
          s.revoked_at as activity_time,
          s.provider,
          s.ip_address,
          s.user_agent,
          s.expires_at,
          s.revoked_at,
          NULL as table_name,
          NULL as operation,
          NULL as changed_data,
          s.revoked_by,
          ru.email as revoked_by_email,
          ru.first_name as revoked_by_first_name,
          ru.last_name as revoked_by_last_name
        FROM sessions s
        LEFT JOIN users ru ON s.revoked_by = ru.id
        WHERE s.user_id = ${userId} 
          AND s.revoked_at IS NOT NULL
        ORDER BY s.revoked_at DESC
        LIMIT 50
      `);

      // Get user's database changes from all CDC tables
      const userChanges = await this.db.execute(sql`
        -- Changes from users table (either made by user or changes to user's own record)
        SELECT 
          'DATABASE_CHANGE' as activity_type,
          _cdc_timestamp as activity_time,
          NULL as provider,
          NULL as ip_address,
          NULL as user_agent,
          NULL as expires_at,
          NULL as revoked_at,
          'users' as table_name,
          _cdc_operation as operation,
          row_to_json(_cdc_users.*) as changed_data
        FROM _cdc_users
        WHERE edited_by = ${userId} OR id = ${userId}

        UNION ALL

        -- Changes from projects table made by user
        SELECT 
          'DATABASE_CHANGE' as activity_type,
          _cdc_timestamp as activity_time,
          NULL as provider,
          NULL as ip_address,
          NULL as user_agent,
          NULL as expires_at,
          NULL as revoked_at,
          'projects' as table_name,
          _cdc_operation as operation,
          row_to_json(_cdc_projects.*) as changed_data
        FROM _cdc_projects
        WHERE edited_by = ${userId}

        UNION ALL

        -- Changes from roles table made by user
        SELECT 
          'DATABASE_CHANGE' as activity_type,
          _cdc_timestamp as activity_time,
          NULL as provider,
          NULL as ip_address,
          NULL as user_agent,
          NULL as expires_at,
          NULL as revoked_at,
          'roles' as table_name,
          _cdc_operation as operation,
          row_to_json(_cdc_roles.*) as changed_data
        FROM _cdc_roles
        WHERE edited_by = ${userId}
        
        ORDER BY activity_time DESC
        LIMIT 100
      `);

      // Get user info
      const [userInfo] = await this.db
        .select({
          id: this.users.id,
          email: this.users.email,
          firstName: this.users.firstName,
          lastName: this.users.lastName
        })
        .from(this.users)
        .where(eq(this.users.id, userId));

      if (!userInfo) {
        throw new Error('User not found');
      }


      // Combine activities
      const allActivities = [
        ...userLogins.rows.map(row => ({
          type: row.activity_type,
          timestamp: row.activity_time,
          details: {
            provider: row.provider,
            ipAddress: row.ip_address,
            userAgent: row.user_agent,
            expiresAt: row.expires_at,
            revokedAt: row.revoked_at
          }
        })),
        ...userLogouts.rows.map(row => ({
          type: row.activity_type,
          timestamp: row.activity_time,
          details: {
            provider: row.provider,
            ipAddress: row.ip_address,
            userAgent: row.user_agent,
            expiresAt: row.expires_at,
            revokedAt: row.revoked_at,
            revokedBy: row.revoked_by,
            revokedByUser: row.revoked_by ? {
              email: row.revoked_by_email,
              firstName: row.revoked_by_first_name,
              lastName: row.revoked_by_last_name,
              fullName: `${row.revoked_by_first_name || ''} ${row.revoked_by_last_name || ''}`.trim()
            } : null
          }
        })),
        ...userChanges.rows.map(row => ({
          type: row.activity_type,
          timestamp: row.activity_time,
          details: {
            tableName: row.table_name,
            operation: row.operation,
            changedData: row.changed_data
          }
        }))
      ];

      // Sort by timestamp descending
      allActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return {
        user: {
          id: userInfo.id,
          email: userInfo.email,
          firstName: userInfo.firstName,
          lastName: userInfo.lastName,
          fullName: `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim()
        },
        activities: allActivities,
        summary: {
          totalActivities: allActivities.length,
          loginCount: userLogins.rows.length,
          logoutCount: userLogouts.rows.length,
          changeCount: userChanges.rows.length
        }
      };

    } catch (error) {
      console.error('Failed to get user activity:', error);
      throw new Error(`Failed to retrieve user activity: ${error.message}`);
    }
  }

  /**
   * Get change history for a specific user record
   * @param userId - User ID to get history for
   * @returns Promise with user's change history from CDC
   */
  async getUserHistory(userId: number) {
    try {
      // Get user's basic info
      const [userInfo] = await this.db
        .select({
          id: this.users.id,
          email: this.users.email,
          firstName: this.users.firstName,
          lastName: this.users.lastName
        })
        .from(this.users)
        .where(eq(this.users.id, userId));

      if (!userInfo) {
        throw new Error('User not found');
      }

      // Get all changes to this specific user record from CDC
      const userHistoryChanges = await this.db.execute(sql`
        SELECT 
          _cdc_id,
          _cdc_timestamp,
          _cdc_operation,
          _cdc_acknowledge,
          id,
          email,
          alias,
          first_name,
          last_name,
          profile_picture,
          url,
          bio,
          birthday,
          gender,
          locale,
          timezone,
          location,
          phone,
          address,
          company,
          is_deleted,
          edited_at,
          edited_by,
          edited_session
        FROM _cdc_users
        WHERE id = ${userId}
        ORDER BY _cdc_timestamp DESC
        LIMIT 50
      `);

      // Get editor information for each change
      const changesWithEditors = await Promise.all(
        userHistoryChanges.rows.map(async (change) => {
          let editorInfo = null;
          if (change.edited_by) {
            const [editor] = await this.db
              .select({
                id: this.users.id,
                email: this.users.email,
                firstName: this.users.firstName,
                lastName: this.users.lastName
              })
              .from(this.users)
              .where(eq(this.users.id, change.edited_by));
            
            editorInfo = editor ? {
              id: editor.id,
              email: editor.email,
              fullName: `${editor.firstName || ''} ${editor.lastName || ''}`.trim()
            } : null;
          }

          return {
            cdcId: change._cdc_id,
            timestamp: change._cdc_timestamp,
            operation: change._cdc_operation,
            acknowledged: change._cdc_acknowledge,
            changedData: {
              id: change.id,
              email: change.email,
              alias: change.alias,
              firstName: change.first_name,
              lastName: change.last_name,
              profilePicture: change.profile_picture,
              url: change.url,
              bio: change.bio,
              birthday: change.birthday,
              gender: change.gender,
              locale: change.locale,
              timezone: change.timezone,
              location: change.location,
              phone: change.phone,
              address: change.address,
              company: change.company,
              isDeleted: change.is_deleted,
              editedAt: change.edited_at,
              editedBy: change.edited_by,
              editedSession: change.edited_session
            },
            editor: editorInfo
          };
        })
      );

      return {
        user: {
          id: userInfo.id,
          email: userInfo.email,
          firstName: userInfo.firstName,
          lastName: userInfo.lastName,
          fullName: `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim()
        },
        changes: changesWithEditors,
        summary: {
          totalChanges: changesWithEditors.length,
          lastModified: changesWithEditors.length > 0 ? changesWithEditors[0].timestamp : null
        }
      };

    } catch (error) {
      console.error('Failed to get user history:', error);
      throw new Error(`Failed to retrieve user history: ${error.message}`);
    }
  }

  // ======================== PERMISSIONS METHODS ========================

  /**
   * Get all available permissions in the system
   */
  async getAllPermissions(): Promise<any[]> {
    try {
      const { permissions } = this.databaseService.schema;
      const allPermissions = await this.db
        .select()
        .from(permissions)
        .orderBy(permissions.permissionGroup, permissions.name);

      return allPermissions;
    } catch (error) {
      console.error('Failed to get all permissions:', error);
      throw new Error(`Failed to retrieve permissions: ${error.message}`);
    }
  }

  /**
   * Get all available roles in the system
   */
  async getAllRoles(): Promise<any[]> {
    try {
      const { roles } = this.databaseService.schema;
      const allRoles = await this.db
        .select()
        .from(roles)
        .where(eq(roles.isDeleted, false))
        .orderBy(roles.roleGroup, roles.name);

      return allRoles;
    } catch (error) {
      console.error('Failed to get all roles:', error);
      throw new Error(`Failed to retrieve roles: ${error.message}`);
    }
  }

  /**
   * Get user permissions from the permissions service
   */
  async getUserPermissions(userId: number): Promise<any[]> {
    try {
      const userPermissions = await this.permissionsService.getUserPermissions(userId);
      return userPermissions;
    } catch (error) {
      console.error('Failed to get user permissions:', error);
      throw new Error(`Failed to retrieve user permissions: ${error.message}`);
    }
  }

  /**
   * Assign permission directly to user
   */
  async assignPermissionToUser(
    userId: number,
    permissionName: string,
    assignedBy: number,
    referenceableType?: string,
    referenceableId?: number
  ): Promise<void> {
    try {
      await this.permissionsService.assignPermissionToUser(
        userId, 
        permissionName, 
        assignedBy, 
        referenceableType, 
        referenceableId
      );
    } catch (error) {
      console.error('Failed to assign permission to user:', error);
      throw new Error(`Failed to assign permission: ${error.message}`);
    }
  }

  /**
   * Assign role to user
   */
  async assignRoleToUser(
    userId: number,
    roleName: string,
    assignedBy: number,
    referenceableType?: string,
    referenceableId?: number
  ): Promise<void> {
    try {
      await this.permissionsService.assignRoleToUser(
        userId, 
        roleName, 
        assignedBy, 
        referenceableType, 
        referenceableId
      );
    } catch (error) {
      console.error('Failed to assign role to user:', error);
      throw new Error(`Failed to assign role: ${error.message}`);
    }
  }

  /**
   * Remove permission from user
   */
  async removePermissionFromUser(
    userId: number,
    permissionName: string,
    removedBy: number
  ): Promise<void> {
    try {
      await this.permissionsService.removePermissionFromUser(
        userId, 
        permissionName, 
        removedBy
      );
    } catch (error) {
      console.error('Failed to remove permission from user:', error);
      throw new Error(`Failed to remove permission: ${error.message}`);
    }
  }

  /**
   * Remove role from user
   */
  async removeRoleFromUser(
    userId: number,
    roleName: string,
    removedBy: number
  ): Promise<void> {
    try {
      await this.permissionsService.removeRoleFromUser(
        userId, 
        roleName, 
        removedBy
      );
    } catch (error) {
      console.error('Failed to remove role from user:', error);
      throw new Error(`Failed to remove role: ${error.message}`);
    }
  }

  /**
   * Create new role
   */
  async createRole(roleData: any, createdBy: number): Promise<any> {
    try {
      const { roles } = this.databaseService.schema;
      
      // Create the role
      const [newRole] = await this.db
        .insert(roles)
        .values({
          name: roleData.name,
          label: roleData.label || roleData.name,
          description: roleData.description || null,
          roleGroup: roleData.group || 'custom',
          editedBy: createdBy
        } as any)
        .returning();

      // Assign permissions to role if provided
      if (roleData.permissions && roleData.permissions.length > 0) {
        await this.assignPermissionsToRole(newRole.id, roleData.permissions, createdBy);
      }

      return newRole;
    } catch (error) {
      console.error('Failed to create role:', error);
      throw new Error(`Failed to create role: ${error.message}`);
    }
  }

  /**
   * Update existing role
   */
  async updateRole(roleId: number, roleData: any, updatedBy: number): Promise<any> {
    try {
      const { roles } = this.databaseService.schema;
      
      // Update the role
      const [updatedRole] = await this.db
        .update(roles)
        .set({
          name: roleData.name,
          label: roleData.label || roleData.name,
          description: roleData.description || null,
          roleGroup: roleData.group || 'custom',
          editedBy: updatedBy,
          editedAt: new Date()
        } as any)
        .where(eq(roles.id, roleId))
        .returning();

      // Update role permissions if provided
      if (roleData.permissions) {
        // Remove existing permissions and assign new ones
        await this.clearRolePermissions(roleId, updatedBy);
        if (roleData.permissions.length > 0) {
          await this.assignPermissionsToRole(roleId, roleData.permissions, updatedBy);
        }
      }

      return updatedRole;
    } catch (error) {
      console.error('Failed to update role:', error);
      throw new Error(`Failed to update role: ${error.message}`);
    }
  }

  /**
   * Delete role (soft delete)
   */
  async deleteRole(roleId: number, deletedBy: number): Promise<void> {
    try {
      const { roles } = this.databaseService.schema;
      
      await this.db
        .update(roles)
        .set({
          isDeleted: true,
          editedBy: deletedBy,
          editedAt: new Date()
        } as any)
        .where(eq(roles.id, roleId));

    } catch (error) {
      console.error('Failed to delete role:', error);
      throw new Error(`Failed to delete role: ${error.message}`);
    }
  }

  /**
   * Assign multiple permissions to a role
   */
  private async assignPermissionsToRole(roleId: number, permissionNames: string[], assignedBy: number): Promise<void> {
    try {
      const { permissions, permissionsRolesMap } = this.databaseService.schema;
      
      // Get permission IDs
      const permissionRecords = await this.db
        .select({ id: permissions.id, name: permissions.name })
        .from(permissions)
        .where(sql`${permissions.name} = ANY(${permissionNames})`);

      // Insert permission-role mappings
      const mappings = permissionRecords.map(p => ({
        roleId,
        permissionId: p.id,
        editedBy: assignedBy
      }));

      if (mappings.length > 0) {
        await this.db
          .insert(permissionsRolesMap)
          .values(mappings as any);
      }
    } catch (error) {
      console.error('Failed to assign permissions to role:', error);
      throw error;
    }
  }

  /**
   * Clear all permissions from a role
   */
  private async clearRolePermissions(roleId: number, updatedBy: number): Promise<void> {
    try {
      const { permissionsRolesMap } = this.databaseService.schema;
      
      await this.db
        .update(permissionsRolesMap)
        .set({
          isDeleted: true,
          editedBy: updatedBy,
          editedAt: new Date()
        } as any)
        .where(and(
          eq(permissionsRolesMap.roleId, roleId),
          eq(permissionsRolesMap.isDeleted, false)
        ));
    } catch (error) {
      console.error('Failed to clear role permissions:', error);
      throw error;
    }
  }

  /**
   * Get scopeable entities configuration
   */
  async getScopeableEntities(): Promise<any> {
    return this.scopeConfigService.getScopeableEntities();
  }

  /**
   * Get scope settings
   */
  async getScopeSettings(): Promise<any> {
    return this.scopeConfigService.getScopeSettings();
  }

  /**
   * Get entity instances for a specific entity type
   */
  async getEntityInstances(entityType: string): Promise<any[]> {
    return this.scopeConfigService.getEntityInstances(entityType);
  }
}




