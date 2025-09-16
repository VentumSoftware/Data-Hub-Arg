import { FSNodeDTO, FSGetNodeDTO, FSGetDirDTO, FSCreateDirDTO, FSDeleteNodeDTO, FSRenameNodeDTO } from './fs.dtos';
import { Injectable } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';

import * as mime from 'mime-types';
import { Response } from 'express';
import { FsRepository } from './fs.repository';

export interface FsUserContext {
  editedBy?: number;  // null means system/sysadmin
  editedSession?: string;  // null when editedBy is null
  referenceableType?: string;
  referenceableId?: number;
}

@Injectable()
export class FsService {
  constructor(private readonly fsRepository: FsRepository) { }

  async getNode(dto: FSGetNodeDTO): Promise<FSNodeDTO> {
    dto.path = dto.path || '/';
    return this.fsRepository.getNode(dto.path, dto.recursive);
  }

  async getDirectory(dto: FSGetDirDTO): Promise<FSNodeDTO[]> {
    let res = await this.fsRepository.readDir(dto.path);

    if (dto.recursive) {
      for (const f of res) {
        if (f.type === 'dir') {
          f.childs = await this.getDirectory({ path: f.path, recursive: true });
        }
      }
    }

    return res;
  }

  async createDirectory(dto: FSCreateDirDTO, context?: FsUserContext): Promise<FSNodeDTO> {
    const editedBy = context?.editedBy || 1; // Default to system user
    const editedSession = context?.editedBy ? context.editedSession : null;
    
    if (dto.ensureParent) {
      const segments = dto.path.split('/').filter(segment => segment !== '');
      let currentPath = '/';

      for (const segment of segments) {
        currentPath += segment + '/';
        try {
          await this.fsRepository.createDir(
            currentPath, 
            editedBy, 
            editedSession,
            context?.referenceableType,
            context?.referenceableId
          );
        } catch (err: any) {
          // Ignore error if directory already exists (Error 4)
          if (err?.code !== 4) throw err;
        }
      }
    } else {
      await this.fsRepository.createDir(
        dto.path, 
        editedBy, 
        editedSession,
        context?.referenceableType,
        context?.referenceableId
      );
    }

    return this.getNode({ path: dto.path, recursive: false });
  }

  async deleteNode(dto: FSDeleteNodeDTO, context?: FsUserContext): Promise<void> {
    const editedBy = context?.editedBy || 1; // Default to system user
    const editedSession = context?.editedBy ? context.editedSession : null;
    
    const rootNode = await this.getNode({ path: dto.path, recursive: false });

    if (dto.recursive && rootNode.type === 'dir') {
      const nodes = await this.getDirectory({ path: dto.path, recursive: false });
      for (const node of nodes) {
        if (node.type === 'dir') {
          await this.deleteNode({ path: node.path, recursive: true }, context);
        } else {
          await this.fsRepository.removeFile(
            node.path, 
            editedBy, 
            editedSession,
            context?.referenceableType,
            context?.referenceableId
          );
        }
      }
    }

    rootNode.type === 'dir' ?
      await this.fsRepository.removeDir(
        dto.path, 
        editedBy, 
        editedSession,
        context?.referenceableType,
        context?.referenceableId
      ) :
      await this.fsRepository.removeFile(
        dto.path, 
        editedBy, 
        editedSession,
        context?.referenceableType,
        context?.referenceableId
      );
  }

  async renameNode(dto: FSRenameNodeDTO, context?: FsUserContext): Promise<FSNodeDTO> {
    const editedBy = context?.editedBy || 1; // Default to system user
    const editedSession = context?.editedBy ? context.editedSession : null;
    
    await this.fsRepository.renameNode(
      dto.path, 
      dto.newPath, 
      editedBy, 
      editedSession,
      context?.referenceableType,
      context?.referenceableId
    );
    return this.getNode({ path: dto.newPath, recursive: false });
  }

  async readFile(path: string): Promise<Buffer> {
    return (await this.fsRepository.readFile(path));
  }

  async writeFile(
    path: string, 
    data: Buffer, 
    context?: FsUserContext,
    ensureParentDir?: boolean,
    originalName?: string
  ): Promise<FSNodeDTO> {
    const editedBy = context?.editedBy || 1; // Default to system user
    const editedSession = context?.editedBy ? context.editedSession : null;
    
    if (ensureParentDir) {
      const segments = path.split('/').filter(segment => segment !== '');
      segments.pop();
      let currentPath = '/';
      for (const segment of segments) {
        currentPath += segment + '/';
        try {
          await this.fsRepository.createDir(
            currentPath, 
            editedBy, 
            editedSession,
            context?.referenceableType,
            context?.referenceableId
          );
        } catch (err: any) {
          // Ignore error if directory already exists (Error 4)
          if (err?.code !== 4) throw err;
        }
      }
    }
    await this.fsRepository.writeFile(
      path, 
      data, 
      editedBy, 
      editedSession,
      context?.referenceableType,
      context?.referenceableId,
      originalName
    );
    return this.getNode({ path, recursive: false });
  }

  async serveFile(
    res: Response,
    filePath: string,
    fallbackPath?: string,
    isFallbackAttempt = false
  ): Promise<void> {
    try {
      const buffer = await this.fsRepository.readFile(filePath);
      const mimeType = mime.lookup(filePath) || 'application/octet-stream';
      res.setHeader('Content-Type', mimeType);
      res.send(buffer);
    } catch (err) {
      if (!fallbackPath || isFallbackAttempt) {
        throw new NotFoundException(
          isFallbackAttempt 
            ? 'Archivo no encontrado y fallback falló.' 
            : 'Archivo no encontrado.'
        );
      }

      console.warn(`[FS] Archivo no encontrado: ${filePath}. Intentando fallback.`);
      await this.serveFile(res, fallbackPath, undefined, true);
    }
  }

}
