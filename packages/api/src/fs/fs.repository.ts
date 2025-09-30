import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Client, SFTPWrapper, Stats, FileEntryWithStats } from 'ssh2';
import { FSNodeDTO } from './fs.dtos';
import { DatabaseService } from '../database/database.service';
import { fsNodes } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import * as mime from 'mime-types';

export const rootPath = '/uploads';
const addRootPath = (path: string) => rootPath + (path.startsWith('/') ? path : '/' + path);

export const sftpConfig = {
    host: process.env.SFTP_HOST,
    username: process.env.SFTP_USERNAME,
    password: process.env.SFTP_PASSWORD,
    port: Number(process.env.SFTP_PORT)
};

@Injectable()
export class FsRepository implements OnModuleInit, OnModuleDestroy {
    private client: Client | null = null;
    private sftp: SFTPWrapper | null = null;

    constructor(private readonly databaseService: DatabaseService) {}

    private readonly ttlMs = 60 * 60 * 1000; //1h
    private lastUsedAt = 0;
    private ttlTimer: NodeJS.Timeout | null = null;
    private connecting: Promise<void> | null = null;

    private resetTtlTimer() {
        if (this.ttlTimer) clearTimeout(this.ttlTimer);
        this.ttlTimer = setTimeout(() => {
            if (Date.now() - this.lastUsedAt >= this.ttlMs) {
                console.log('[SFTP] TTL expired, closing connection');
                this.disconnect();
            }
        }, this.ttlMs);
    }

    private disconnect() {
        this.sftp = null;
        this.client?.end();
        this.client = null;
    }

    private async connectSftp(): Promise<void> {
        return new Promise((resolve, reject) => {
            const client = new Client();
            client
                .on('ready', () => {
                    client.sftp((err, sftp) => {
                        if (err) {
                            client.end();
                            return reject(err);
                        }
                        this.client = client;
                        this.sftp = sftp;
                        resolve();
                    });
                })
                .on('timeout', () => {
                    client.end();
                    reject(new Error('Connection timeout'));
                })
                .on('error', (err) => {
                    this?.disconnect();
                    reject(err);
                })
                .on('end', () => {
                    this?.disconnect();
                })
                .connect(sftpConfig);
        });
    }

    private async ensureConnected() {
        if (this.sftp) {
            this.lastUsedAt = Date.now();
            this.resetTtlTimer();
            return;
        }
        if (!this.connecting) {
            this.connecting = this.connectSftp().finally(() => {
                this.connecting = null;
                this.lastUsedAt = Date.now();
                this.resetTtlTimer();
            });
        }
        await this.connecting;
    }

    private async withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
        let attempt = 0;
        while (attempt < retries) {
            try {
                await this.ensureConnected();
                return await fn();
            } catch (err: any) {
                console.warn('[SFTP] Operation failed, trying to reconnect...', err.message);
                this.disconnect();
                await this.ensureConnected();
                return await fn();
            }
        }
        throw new Error('Failed to perform operation after multiple retries');
    }

    private fileEntryToNodeDTO = (f: FileEntryWithStats, path: string): FSNodeDTO => {
        const type = f.longname.charAt(0) === 'd' ? 'dir' : 'file';
        const parentPath = path.endsWith('/') ? path.slice(0, -1) : path;
        return {
            name: f.filename,
            path: parentPath + '/' + f.filename,
            type,
            size: type === 'file' ? f.attrs?.size : undefined,
            lastAccess: new Date(f.attrs?.atime * 1000)?.toISOString(),
            lastUpdate: new Date(f.attrs?.mtime * 1000)?.toISOString(),
            lastMod: new Date(f.attrs?.mtime * 1000)?.toISOString(),
        };
    };

    private statsToNodeDTO = (f: Stats, path: string): FSNodeDTO => {
        const type = f.isDirectory() ? 'dir' : 'file';
        const parent = path.split('/').filter(x => x !== '');
        const filename = parent.pop() || '';
        let parentPath = parent.join('/');

        return {
            name: filename,
            path: parentPath + '/' + filename,
            type,
            size: type === 'file' ? f.size : undefined,
            lastAccess: new Date(f.atime * 1000)?.toISOString(),
            lastUpdate: new Date(f.mtime * 1000)?.toISOString(),
            lastMod: new Date(f.mtime * 1000)?.toISOString(),
        };
    };

    async onModuleInit() {
        await this.ensureConnected()
            .catch((err) => console.warn('[SFTP] Failed to ensure connection...', err.message));
    }

    async onModuleDestroy() {
        this.disconnect();
    }

    // Database Sync Methods
    private async syncNodeToDatabase(
        path: string,
        type: 'file' | 'dir',
        stats: Stats,
        editedBy: number,
        editedSession?: string,
        referenceableType?: string,
        referenceableId?: number,
        originalName?: string,
        publicPath?: string
    ): Promise<number> {
        console.log(`[DB SYNC] Syncing node: ${path}, type: ${type}`);
        const name = path.split('/').filter(x => x !== '').pop() || '';
        const mimeType = type === 'file' ? mime.lookup(name) || 'application/octet-stream' : null;

        const nodeData = {
            name,
            type,
            path,
            publicPath,
            size: type === 'file' ? stats.size : 0,
            childFoldersCount: type === 'dir' ? 0 : null,
            childFilesCount: type === 'dir' ? 0 : null,
            originalName: originalName || null,
            mimeType,
            referenceableType,
            referenceableId,
            isDeleted: false,
            editedAt: new Date(),
            editedBy,
            editedSession
        };
        try {


            // Check if node exists
            const whereConditions = [eq(fsNodes.path, path)];
            if (referenceableType && referenceableId) {
                whereConditions.push(
                    eq(fsNodes.referenceableType, referenceableType),
                    eq(fsNodes.referenceableId, referenceableId)
                );
            }

            const existing = await this.databaseService.db
                .select()
                .from(fsNodes)
                .where(and(...whereConditions))
                .limit(1);

            if (existing.length > 0) {
                // Update existing node
                await this.databaseService.db
                    .update(fsNodes)
                    .set(nodeData)
                    .where(eq(fsNodes.id, existing[0].id));
                console.log(`[DB SYNC] Success: ${path}`);
                return existing[0].id;
            } else {
                // Insert new node and return the id
                let res = await this.databaseService.db
                    .insert(fsNodes)
                    .values(nodeData).returning()
                console.log(`[DB SYNC] Success: ${path}`);
                return res[0].id

            }
        } catch (error) {
            console.error(`[DB SYNC] Error syncing node: ${path}`, error);
        }
    }

    private async removeNodeFromDatabase(
        path: string,
        editedBy: number,
        editedSession?: string,
        referenceableType?: string,
        referenceableId?: number
    ): Promise<void> {
        const whereConditions = [eq(fsNodes.path, path)];
        if (referenceableType && referenceableId) {
            whereConditions.push(
                eq(fsNodes.referenceableType, referenceableType),
                eq(fsNodes.referenceableId, referenceableId)
            );
        }
        
        await this.databaseService.db
            .update(fsNodes)
            .set({ 
                isDeleted: true,
                editedAt: new Date(),
                editedBy,
                editedSession
            } as any)
            .where(and(...whereConditions));
    }

    private async renameNodeInDatabase(
        oldPath: string,
        newPath: string,
        editedBy: number,
        editedSession?: string,
        referenceableType?: string,
        referenceableId?: number
    ): Promise<void> {
        const newName = newPath.split('/').filter(x => x !== '').pop() || '';
        
        const whereConditions = [eq(fsNodes.path, oldPath)];
        if (referenceableType && referenceableId) {
            whereConditions.push(
                eq(fsNodes.referenceableType, referenceableType),
                eq(fsNodes.referenceableId, referenceableId)
            );
        }
        
        await this.databaseService.db
            .update(fsNodes)
            .set({ 
                path: newPath,
                name: newName,
                editedAt: new Date(),
                editedBy,
                editedSession
            } as any)
            .where(and(...whereConditions));
    }

    // Repository Methods
    async getNode(path: string, recursive: boolean): Promise<FSNodeDTO> {
        return this.withRetry(() =>
            new Promise((rs, rj) =>
                this.sftp!.stat(addRootPath(path), async (err: Error | null, stats: Stats) => {
                    if (err) return rj(err);
                    const node = this.statsToNodeDTO(stats, path);
                    if (recursive && node.type === 'dir') {
                        node.childs = await new Promise((rs, rj) => {
                            this.sftp!.readdir(addRootPath(path), async (err: Error | null, list: FileEntryWithStats[]) => {
                                if (err) return rj(err);
                                const nodes = await Promise.all(list.map(x => this.getNode(path + '/' + x.filename, recursive)));
                                rs(nodes);
                            });
                        })
                    }
                    rs(node);
                })
            )
        );
    }

    async readDir(path: string): Promise<FSNodeDTO[]> {
        return this.withRetry(() =>
            new Promise((rs, rj) => {
                this.sftp!.readdir(addRootPath(path), (err: Error | null, list: FileEntryWithStats[]) => {
                    if (err) return rj(err);
                    const nodes = list.map(x => this.fileEntryToNodeDTO(x, addRootPath(path)));
                    rs(nodes);
                });
            })
        );
    }

    async createDir(
        path: string, 
        editedBy: number, 
        editedSession?: string,
        referenceableType?: string, 
        referenceableId?: number
    ): Promise<number> {
        // First perform SFTP operation
        await this.withRetry(() =>
            new Promise<void>((rs, rj) =>
                this.sftp!.mkdir(addRootPath(path), (err) => err ? rj(err) : rs())
            )
        );
        
        // If SFTP operation successful, sync to database
        const stats = await this.withRetry(() =>
            new Promise<Stats>((rs, rj) =>
                this.sftp!.stat(addRootPath(path), (err, stats) => err ? rj(err) : rs(stats))
            )
        );
        
        return (await this.syncNodeToDatabase(
            path, 
            'dir', 
            stats, 
            editedBy, 
            editedSession,
            referenceableType, 
            referenceableId
        ));
    }

    async removeDir(
        path: string, 
        editedBy: number, 
        editedSession?: string,
        referenceableType?: string, 
        referenceableId?: number
    ): Promise<void> {
        // First perform SFTP operation
        await this.withRetry(() =>
            new Promise<void>((rs, rj) =>
                this.sftp!.rmdir(addRootPath(path), (err) => err ? rj(err) : rs())
            )
        );
        
        // If SFTP operation successful, sync to database
        await this.removeNodeFromDatabase(
            path, 
            editedBy, 
            editedSession,
            referenceableType, 
            referenceableId
        );
    }

    async renameNode(
        oldPath: string, 
        newPath: string, 
        editedBy: number, 
        editedSession?: string,
        referenceableType?: string, 
        referenceableId?: number
    ): Promise<void> {
        // First perform SFTP operation
        await this.withRetry(() =>
            new Promise<void>((rs, rj) =>
                this.sftp!.rename(addRootPath(oldPath), addRootPath(newPath), (err) => err ? rj(err) : rs())
            )
        );
        
        // If SFTP operation successful, sync to database
        await this.renameNodeInDatabase(
            oldPath, 
            newPath, 
            editedBy, 
            editedSession,
            referenceableType, 
            referenceableId
        );
    }

    async readFile(path: string): Promise<Buffer> {
        return this.withRetry(() =>
            new Promise((rs, rj) => {
                this.sftp!.readFile(addRootPath(path), (err: any, data: Buffer) => {
                    err ? rj(err) : rs(data);
                });
            })
        );
    }

    async writeFile(
        path: string, 
        data: Buffer, 
        editedBy: number, 
        editedSession?: string,
        referenceableType?: string, 
        referenceableId?: number,
        originalName?: string
    ): Promise<number> {
            console.log('📁 FsService.writeFile - Intentando escribir:', path);
    console.log('📁 Contexto usuario:', editedBy);
        // First perform SFTP operation
        await this.withRetry(() =>
            new Promise<void>((rs, rj) =>
                this.sftp!.writeFile(addRootPath(path), data, (err) => err ? rj(err) : rs())
            )
        );
        
        // If SFTP operation successful, sync to database
        const stats = await this.withRetry(() =>
            new Promise<Stats>((rs, rj) =>
                this.sftp!.stat(addRootPath(path), (err, stats) => err ? rj(err) : rs(stats))
            )
        );
        
        return (await this.syncNodeToDatabase(
            path, 
            'file', 
            stats, 
            editedBy, 
            editedSession,
            referenceableType, 
            referenceableId,
            originalName
        ));
    }

    async removeFile(
        path: string, 
        editedBy: number, 
        editedSession?: string,
        referenceableType?: string, 
        referenceableId?: number
    ): Promise<void> {
        // First perform SFTP operation
        await this.withRetry(() =>
            new Promise<void>((rs, rj) =>
                this.sftp!.unlink(addRootPath(path), (err) => err ? rj(err) : rs())
            )
        );
        
        // If SFTP operation successful, sync to database
        await this.removeNodeFromDatabase(
            path, 
            editedBy, 
            editedSession,
            referenceableType, 
            referenceableId
        );
    }

}