import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as xml2js from 'xml2js';
import { DatabaseService } from '../../database/database.service';
import { sql } from 'drizzle-orm';

export interface ScopeableEntity {
    type: string;
    label: string;
    description: string;
    table: string;
    idColumn: string;
    displayColumn: string;
    icon: string;
    allowedPermissions: string[];
}

export interface ScopeSettings {
    allowGlobalPermissions: boolean;
    scopeAllPermissions: boolean;
    defaultScopeType: string;
}

export interface EntityInstance {
    id: number;
    display: string;
    type: string;
    metadata?: any;
}

@Injectable()
export class ScopeConfigService {
    private readonly logger = new Logger(ScopeConfigService.name);
    private scopeableEntities: ScopeableEntity[] = [];
    private scopeSettings: ScopeSettings;
    private configLoaded = false;

    constructor(private readonly databaseService: DatabaseService) {
        this.loadConfiguration();
    }

    /**
     * Load and parse the XML configuration file
     */
    private async loadConfiguration(): Promise<void> {
        try {
            const configPath = path.join(process.cwd(), 'config', 'scopeable-entities.xml');
            
            // Check if file exists
            if (!fs.existsSync(configPath)) {
                this.logger.warn('Scopeable entities configuration file not found, using defaults');
                this.setDefaultConfiguration();
                return;
            }

            const xmlContent = fs.readFileSync(configPath, 'utf8');
            const parser = new xml2js.Parser();
            
            const result = await parser.parseStringPromise(xmlContent);
            
            if (result.scopeableEntities) {
                // Parse entities
                if (result.scopeableEntities.entity) {
                    this.scopeableEntities = result.scopeableEntities.entity.map(entity => ({
                        type: entity.type[0],
                        label: entity.label[0],
                        description: entity.description[0],
                        table: entity.table[0],
                        idColumn: entity.idColumn[0],
                        displayColumn: entity.displayColumn[0],
                        icon: entity.icon ? entity.icon[0] : 'folder',
                        allowedPermissions: this.parseAllowedPermissions(entity.allowedPermissions)
                    }));
                }

                // Parse settings
                if (result.scopeableEntities.settings) {
                    const settings = result.scopeableEntities.settings[0];
                    this.scopeSettings = {
                        allowGlobalPermissions: settings.allowGlobalPermissions[0] === 'true',
                        scopeAllPermissions: settings.scopeAllPermissions[0] === 'true',
                        defaultScopeType: settings.defaultScopeType[0] || 'global'
                    };
                }
            }

            this.configLoaded = true;
            this.logger.log(`Loaded ${this.scopeableEntities.length} scopeable entity configurations`);
            
        } catch (error) {
            this.logger.error('Failed to load scopeable entities configuration:', error);
            this.setDefaultConfiguration();
        }
    }

    /**
     * Parse allowed permissions from XML structure
     */
    private parseAllowedPermissions(allowedPermissions: any): string[] {
        if (!allowedPermissions || !allowedPermissions[0] || !allowedPermissions[0].permission) {
            return ['*'];
        }
        
        return allowedPermissions[0].permission.map(p => p);
    }

    /**
     * Set default configuration if XML file is not available
     */
    private setDefaultConfiguration(): void {
        this.scopeableEntities = [
            {
                type: 'company',
                label: 'Empresa',
                description: 'Scope permissions to a specific company',
                table: 'companies',
                idColumn: 'id',
                displayColumn: 'name',
                icon: 'business',
                allowedPermissions: ['*']
            },
            {
                type: 'project',
                label: 'Proyecto',
                description: 'Scope permissions to a specific project',
                table: 'projects',
                idColumn: 'id',
                displayColumn: 'name',
                icon: 'apartment',
                allowedPermissions: ['*']
            }
        ];

        this.scopeSettings = {
            allowGlobalPermissions: true,
            scopeAllPermissions: false,
            defaultScopeType: 'global'
        };

        this.configLoaded = true;
    }

    /**
     * Get all configured scopeable entities
     */
    getScopeableEntities(): ScopeableEntity[] {
        return this.scopeableEntities;
    }

    /**
     * Get scope settings
     */
    getScopeSettings(): ScopeSettings {
        return this.scopeSettings;
    }

    /**
     * Check if a specific entity type is scopeable
     */
    isScopeable(entityType: string): boolean {
        return this.scopeableEntities.some(e => e.type === entityType);
    }

    /**
     * Get scopeable entity configuration by type
     */
    getScopeableEntity(entityType: string): ScopeableEntity | null {
        return this.scopeableEntities.find(e => e.type === entityType) || null;
    }

    /**
     * Check if a permission can be scoped to a specific entity type
     */
    canPermissionBeScoped(permissionName: string, entityType: string): boolean {
        const entity = this.getScopeableEntity(entityType);
        if (!entity) return false;
        
        // If allowedPermissions contains '*', all permissions can be scoped
        if (entity.allowedPermissions.includes('*')) return true;
        
        // Otherwise check if the specific permission is allowed
        return entity.allowedPermissions.includes(permissionName);
    }

    /**
     * Get all entity instances for a specific entity type
     */
    async getEntityInstances(entityType: string): Promise<EntityInstance[]> {
        const entity = this.getScopeableEntity(entityType);
        if (!entity) {
            throw new Error(`Entity type '${entityType}' is not scopeable`);
        }

        try {
            const db = this.databaseService.db;
            
            // Build dynamic query based on entity configuration
            const query = sql`
                SELECT 
                    ${sql.identifier(entity.idColumn)} as id,
                    ${sql.identifier(entity.displayColumn)} as display
                FROM ${sql.identifier(entity.table)}
                WHERE is_deleted = false OR is_deleted IS NULL
                ORDER BY ${sql.identifier(entity.displayColumn)}
            `;

            const queryResult = await db.execute(query);
            const results = (queryResult as any).data || [];
            
            return results.map(row => ({
                id: row.id,
                display: row.display,
                type: entityType
            }));
            
        } catch (error) {
            this.logger.error(`Failed to fetch instances for entity type '${entityType}':`, error);
            return [];
        }
    }

    /**
     * Get a specific entity instance
     */
    async getEntityInstance(entityType: string, entityId: number): Promise<EntityInstance | null> {
        const entity = this.getScopeableEntity(entityType);
        if (!entity) {
            return null;
        }

        try {
            const db = this.databaseService.db;
            
            const query = sql`
                SELECT 
                    ${sql.identifier(entity.idColumn)} as id,
                    ${sql.identifier(entity.displayColumn)} as display
                FROM ${sql.identifier(entity.table)}
                WHERE ${sql.identifier(entity.idColumn)} = ${entityId}
                LIMIT 1
            `;

            const queryResult = await db.execute(query);
            const results = (queryResult as any).data || [];
            
            if (results.length === 0) {
                return null;
            }

            return {
                id: results[0].id,
                display: results[0].display,
                type: entityType
            };
            
        } catch (error) {
            this.logger.error(`Failed to fetch entity instance '${entityType}:${entityId}':`, error);
            return null;
        }
    }

    /**
     * Validate if an entity instance exists
     */
    async validateEntityInstance(entityType: string, entityId: number): Promise<boolean> {
        const instance = await this.getEntityInstance(entityType, entityId);
        return instance !== null;
    }
}