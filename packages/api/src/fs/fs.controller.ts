import { FsService, FsUserContext } from './fs.service';
import { FSNodeDTO, FSGetNodeDTO, FSGetDirDTO, FSCreateDirDTO, FSRenameNodeDTO, FSDeleteNodeDTO } from './fs.dtos';
import { Controller, Get, Post, Body, Patch, Param, Delete, Query, HttpException, HttpStatus, UploadedFile, UseInterceptors, Res, NotFoundException, Req, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as mime from 'mime-types';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery, ApiParam, ApiConsumes } from '@nestjs/swagger';
import { DirectoryNotFoundException, PermissionDeniedException, FileAlreadyExistsException, ConnectionException } from './fs.exception';
import { RequirePermissions } from '../access/decorators/permissions.decorator';
import { AuthGuard } from '../access/guards/auth.guard';
import { PERMISSIONS } from '../common/permissions/permission-registry';
import { DatabaseService } from '../database/database.service';
import { permissions, permissionsUsersMap, permissionsRolesMap, usersRolesMap, permissionsGroupsMap, usersGroupsMap } from '../../drizzle/schema';
import { eq, and, or } from 'drizzle-orm';
import { PermissionGuard } from '../access/guards/permission.guard';

@ApiTags('File System')
@Controller('fs')
@UseGuards(AuthGuard, PermissionGuard)
export class FsController {
  constructor(
    private readonly fsService: FsService,
    private readonly databaseService: DatabaseService
  ) { }

  private async checkUserPermission(userId: number, permission: string): Promise<boolean> {
    if (!userId) return false;
    
    const db = this.databaseService.db;
    const userPermissions = await db
      .select({ name: permissions.name })
      .from(permissions)
      .leftJoin(permissionsUsersMap, eq(permissions.id, permissionsUsersMap.permissionId))
      .leftJoin(permissionsRolesMap, eq(permissions.id, permissionsRolesMap.permissionId))
      .leftJoin(usersRolesMap, eq(permissionsRolesMap.roleId, usersRolesMap.roleId))
      .leftJoin(permissionsGroupsMap, eq(permissions.id, permissionsGroupsMap.permissionId))
      .leftJoin(usersGroupsMap, eq(permissionsGroupsMap.usersGroupId, usersGroupsMap.usersGroupId))
      .where(
        or(
          and(eq(permissionsUsersMap.userId, userId), eq(permissionsUsersMap.isDeleted, false)),
          and(eq(usersRolesMap.userId, userId), eq(usersRolesMap.isDeleted, false), eq(permissionsRolesMap.isDeleted, false)),
          and(eq(usersGroupsMap.userId, userId), eq(usersGroupsMap.isDeleted, false), eq(permissionsGroupsMap.isDeleted, false))
        )
      );
    
    return userPermissions.some(p => p.name === permission);
  }

  private extractUserContext(req: Request, referenceableType?: string, referenceableId?: number): FsUserContext {
    const user = req['user'];
    const session = req['session'];
    
    // Try to get from query params if not provided
    const refType = referenceableType || (req.query?.referenceableType as string);
    const refId = referenceableId || (req.query?.referenceableId ? parseInt(req.query.referenceableId as string) : undefined);
    
    return {
      editedBy: user?.id || null,
      editedSession: session?.token || null,
      referenceableType: refType,
      referenceableId: refId
    };
  }
  @RequirePermissions([{ permission: PERMISSIONS.FS.READ_NODE }])
  @ApiOperation({ summary: 'Get node', description: 'Get node information (file/directory)' })
  @ApiResponse({ status: 200, description: 'Node information', type: FSNodeDTO })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 404, description: 'Node not found' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  @ApiResponse({ status: 503, description: 'Connection error' })
  @ApiParam({ name: 'path', description: 'Path of the node' })
  @ApiQuery({ name: 'recursive', required: false, description: 'Get recursively', type: Boolean })
  @Get('node/:path(*)')
  async getNode(@Param('path') path: string, @Query('recursive') recursive: boolean = false) {
    const query: FSGetNodeDTO = { path, recursive };
    return this.fsService.getNode(query).catch(error => this.handleFsError(error, path));
  }

  @RequirePermissions([{ permission: PERMISSIONS.FS.LIST_DIRECTORY }])
  @ApiOperation({ summary: 'List directory', description: 'List of files and directories' })
  @ApiResponse({ status: 200, description: 'List of files and directories', type: FSNodeDTO, isArray: true })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 404, description: 'Directory not found' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  @ApiResponse({ status: 503, description: 'Connection error' })
  @ApiParam({ name: 'path', description: 'Path of the directory' })
  @ApiQuery({ name: 'recursive', required: false, description: 'List recursively', type: Boolean })
  @Get('dir/:path(*)')
  async getDirectory(@Param('path') path: string, @Query('recursive') recursive: boolean = false) {
    const query: FSGetDirDTO = { path, recursive };
    return this.fsService.getDirectory(query).catch(error => this.handleFsError(error, query.path));
  }

  @RequirePermissions([{ permission: PERMISSIONS.FS.CREATE_DIRECTORY }])
  @ApiOperation({ summary: 'Create directory', description: 'Creates a directory at the specified path' })
  @ApiResponse({ status: 201, description: 'Directory successfully created' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 404, description: 'Parent directory not found' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  @ApiResponse({ status: 409, description: 'Directory already exists' })
  @ApiResponse({ status: 503, description: 'Connection error' })
  @ApiQuery({ name: 'referenceableType', required: false, description: 'Type of entity this directory belongs to' })
  @ApiQuery({ name: 'referenceableId', required: false, description: 'ID of entity this directory belongs to' })
  @ApiBody({ type: FSCreateDirDTO })
  @Post('dir')
  async createDirectory(@Body() body: FSCreateDirDTO, @Req() req: Request) {
    const context = this.extractUserContext(req);
    return await this.fsService.createDirectory(body, context).catch(error => this.handleFsError(error, body.path));
  }

  @RequirePermissions([{ permission: PERMISSIONS.FS.RENAME_NODE }])
  @ApiOperation({ summary: 'Rename/Move node', description: 'Renames or moves a node (file/directory)' })
  @ApiResponse({ status: 200, description: 'Node successfully renamed' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 404, description: 'Node not found' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  @ApiResponse({ status: 503, description: 'Connection error' })
  @ApiQuery({ name: 'referenceableType', required: false, description: 'Type of entity this node belongs to' })
  @ApiQuery({ name: 'referenceableId', required: false, description: 'ID of entity this node belongs to' })
  @ApiBody({ type: FSRenameNodeDTO })
  @Patch('node/rename')
  async renameNode(@Body() body: FSRenameNodeDTO, @Req() req: Request) {
    const context = this.extractUserContext(req);
    return await this.fsService.renameNode(body, context).catch(error => this.handleFsError(error, body.path));
  }

  @RequirePermissions([{ permission: PERMISSIONS.FS.DELETE_FILE }, { permission: PERMISSIONS.FS.DELETE_DIRECTORY }])
  @ApiOperation({ summary: 'Delete node', description: 'Deletes a node (file/directory) at the specified path' })
  @ApiResponse({ status: 200, description: 'Node successfully deleted' })
  @ApiResponse({ status: 404, description: 'Node not found' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  @ApiResponse({ status: 503, description: 'Connection error' })
  @ApiParam({ name: 'path', description: 'Path of the node' })
  @ApiQuery({ name: 'recursive', required: false, description: 'Delete recursively', type: Boolean })
  @ApiQuery({ name: 'referenceableType', required: false, description: 'Type of entity this node belongs to' })
  @ApiQuery({ name: 'referenceableId', required: false, description: 'ID of entity this node belongs to' })
  @Delete('node/:path(*)')
  async deleteNode(@Param('path') path: string, @Query('recursive') recursive: boolean = false, @Req() req: Request) {
    // Check for recursive delete permission if needed
    if (recursive) {
      const user = req['user'];
      const hasRecursivePermission = await this.checkUserPermission(user?.id, PERMISSIONS.FS.DELETE_RECURSIVE);
      if (!hasRecursivePermission) {
        throw new HttpException('Recursive delete permission required', HttpStatus.FORBIDDEN);
      }
    }
    
    const dto: FSDeleteNodeDTO = { path, recursive };
    const context = this.extractUserContext(req);
    return await this.fsService.deleteNode(dto, context).catch(error => this.handleFsError(error, path));
  }

  @RequirePermissions([{ permission: PERMISSIONS.FS.READ_FILE }])
  @ApiOperation({ summary: 'Read file', description: 'Reads the content of a file' })
  @ApiResponse({ status: 200, description: 'File content' })
  @ApiResponse({ status: 404, description: 'File not found' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  @ApiResponse({ status: 503, description: 'Connection error' })
  @Get('file/:path(*)')
  async readFile(@Param('path') path: string) {
    return await this.fsService.readFile(path).catch(error => this.handleFsError(error, path));
  }

  @RequirePermissions([{ permission: 'fs:upload:file' }])
  @ApiOperation({ summary: 'Write file', description: 'Writes a file to the specified path' })
  @ApiResponse({ status: 200, description: 'The file details', type: FSNodeDTO })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  @ApiResponse({ status: 409, description: 'File already exists' })
  @ApiResponse({ status: 503, description: 'Connection error' })
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'The file to upload'
        },
        path: {
          type: 'string',
          description: 'Path where to save the file',
          example: '/folder/filename.txt'
        },
        ensureParentDir: {
          type: 'boolean',
          description: 'Ensure parent directory exists',
          example: true
        },
        referenceableType: {
          type: 'string',
          description: 'Type of entity this file belongs to',
          example: 'projects'
        },
        referenceableId: {
          type: 'string',
          description: 'ID of entity this file belongs to',
          example: '123'
        }
      }
    }
  })
  @Post('file')
  async createFile(@UploadedFile() file: Express.Multer.File, @Body() body: { path: string, ensureParentDir?: boolean, referenceableType?: string, referenceableId?: number }, @Req() req: Request) {
    if (!file) {
      throw new HttpException('File is required', HttpStatus.BAD_REQUEST);
    }
    const context = this.extractUserContext(req, body.referenceableType, body.referenceableId);
    return await this.fsService.writeFile(body.path, file.buffer, context, body.ensureParentDir, file.originalname).catch(error => this.handleFsError(error, body.path));
  }

  @RequirePermissions([{ permission: PERMISSIONS.FS.SERVE_FILE }])
  @ApiOperation({
    summary: 'Obtener archivo como recurso',
    description: 'Devuelve el archivo solicitado (ej. imagen/logo)'
  })
  @ApiResponse({
    status: 200,
    description: 'Archivo devuelto exitosamente',
    content: {
      'image/*': { schema: { type: 'string', format: 'binary' } },
      'application/octet-stream': { schema: { type: 'string', format: 'binary' } }
    }
  })
  @ApiResponse({ status: 404, description: 'Archivo no encontrado' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  @ApiResponse({ status: 503, description: 'Connection error' })
  @Get('public/:companyId/*')
  async serveAnyFile(
    @Param('companyId') companyId: string,
    @Param() params: any,
    @Res() res: Response
  ) {
    const filePath = params[0];
    const fullPath = `${companyId}/${filePath}`;
    const fallbackPath = 'placeholders/not-found.png';

    return this.fsService.serveFile(res, fullPath, fallbackPath)
      .catch(error => this.handleFsError(error, fullPath));
  }

  private handleFsError(error: any, path: string): never {
    console.error('[FS ERROR]:', error.message, `. Path: ${path}`);

    if (error.code === 2) {
      throw new DirectoryNotFoundException(path);
    } else if (error.code === 3) {
      throw new PermissionDeniedException(path);
    } else if (error.code === 4) {
      throw new FileAlreadyExistsException(path);
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.level === 'client-timeout') {
      throw new ConnectionException(error.message);
    }



    throw new HttpException(
      `FS Error: ${error.message || 'Unknown error'}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
