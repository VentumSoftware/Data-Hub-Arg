import * as winston from 'winston';
import * as OpenSearchTransport from 'winston-opensearch';
import { Client } from '@opensearch-project/opensearch';

interface LogContext {
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  userAgent?: string;
  ipAddress?: string;
  operation?: string;
  component?: string;
  [key: string]: any;
}

class AppLogger {
  private static instance: AppLogger;
  private logger: winston.Logger;
  private opensearchClient?: Client;

  private constructor() {
    this.initializeLogger();
  }

  public static getInstance(): AppLogger {
    if (!AppLogger.instance) {
      AppLogger.instance = new AppLogger();
    }
    return AppLogger.instance;
  }

  private initializeLogger() {
    const transports: winston.transport[] = [];

    // Console transport for development
    if (process.env.NODE_ENV !== 'production') {
      transports.push(
        new winston.transports.Console({
          level: 'debug',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaString = Object.keys(meta).length > 0 ? 
                `\n${JSON.stringify(meta, null, 2)}` : '';
              return `${timestamp} [${level}]: ${message}${metaString}`;
            })
          ),
        })
      );
    }

    // File transport for all environments
    transports.push(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        maxsize: 5242880, // 5MB
        maxFiles: 10,
      })
    );

    // OpenSearch transport
    if (this.shouldUseOpenSearch()) {
      try {
        this.opensearchClient = new Client({
          node: process.env.OPENSEARCH_URL || 'http://opensearch:9200',
          requestTimeout: 5000,
          pingTimeout: 3000,
          ssl: {
            rejectUnauthorized: false
          }
        });

        const opensearchTransport = new (OpenSearchTransport as any)({
          client: this.opensearchClient,
          level: 'info',
          index: this.getIndexName(),
          type: '_doc',
          transformer: this.transformLogEntry,
          ensureMappingTemplate: true,
          mappingTemplate: this.getMappingTemplate(),
          flushInterval: 2000,
        });

        transports.push(opensearchTransport);
      } catch (error) {
        console.warn('Failed to initialize OpenSearch transport:', error.message);
      }
    }

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: {
        service: `${process.env.APP_NAME || 'app'}-api`,
        environment: process.env.NODE_ENV || 'development',
        appName: process.env.APP_NAME || 'app',
        version: process.env.npm_package_version || '1.0.0',
      },
      transports,
    });
  }

  private shouldUseOpenSearch(): boolean {
    return !!(
      process.env.OPENSEARCH_URL || 
      (process.env.NODE_ENV !== 'test')
    );
  }

  private getIndexName(): string {
    const date = new Date().toISOString().split('T')[0];
    const appName = process.env.APP_NAME || 'app';
    return `logs-${appName}-${date}`;
  }

  private transformLogEntry = (logData: any) => {
    return {
      '@timestamp': new Date().toISOString(),
      level: logData.level,
      message: logData.message,
      service: logData.service,
      environment: logData.environment,
      appName: logData.appName,
      version: logData.version,
      ...logData.meta,
    };
  };

  private getMappingTemplate() {
    return {
      index_patterns: ['logs-*'],
      template: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
          'index.refresh_interval': '5s',
        },
        mappings: {
          properties: {
            '@timestamp': { type: 'date' },
            level: { type: 'keyword' },
            message: { type: 'text' },
            service: { type: 'keyword' },
            environment: { type: 'keyword' },
            appName: { type: 'keyword' },
            version: { type: 'keyword' },
            userId: { type: 'keyword' },
            sessionId: { type: 'keyword' },
            correlationId: { type: 'keyword' },
            operation: { type: 'keyword' },
            component: { type: 'keyword' },
            duration: { type: 'integer' },
            statusCode: { type: 'integer' },
            method: { type: 'keyword' },
            url: { type: 'keyword' },
            userAgent: { type: 'text' },
            ipAddress: { type: 'ip' },
            error: {
              properties: {
                name: { type: 'keyword' },
                message: { type: 'text' },
                stack: { type: 'text' },
              },
            },
          },
        },
      },
    };
  }

  // Public logging methods
  public info(message: string, context?: LogContext) {
    this.logger.info(message, context);
  }

  public error(message: string, error?: Error, context?: LogContext) {
    const errorContext = error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    } : {};

    this.logger.error(message, { ...context, ...errorContext });
  }

  public warn(message: string, context?: LogContext) {
    this.logger.warn(message, context);
  }

  public debug(message: string, context?: LogContext) {
    this.logger.debug(message, context);
  }

  // Specialized logging methods
  public logRequest(req: any, res: any, duration: number) {
    const context: LogContext = {
      operation: 'http_request',
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.connection.remoteAddress,
      userId: req.user?.id,
      sessionId: req.sessionID,
      correlationId: req.headers['x-correlation-id'] || req.headers['x-request-id'],
    };

    if (res.statusCode >= 400) {
      this.error(`HTTP ${res.statusCode} - ${req.method} ${req.originalUrl}`, undefined, context);
    } else {
      this.info(`HTTP ${res.statusCode} - ${req.method} ${req.originalUrl}`, context);
    }
  }

  public logDatabaseQuery(query: string, duration: number, context?: LogContext) {
    this.info('Database query executed', {
      ...context,
      operation: 'database_query',
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      duration,
    });
  }

  public logUserAction(action: string, userId: string, context?: LogContext) {
    this.info(`User action: ${action}`, {
      ...context,
      operation: 'user_action',
      userId,
      component: 'user_service',
    });
  }

  public logPermissionCheck(permission: string, userId: string, granted: boolean, context?: LogContext) {
    this.info(`Permission check: ${permission}`, {
      ...context,
      operation: 'permission_check',
      userId,
      permission,
      granted,
      component: 'permission_service',
    });
  }

  public logCDCEvent(tableName: string, operation: string, recordId: string | number, context?: LogContext) {
    this.info(`CDC event: ${operation} on ${tableName}`, {
      ...context,
      operation: 'cdc_event',
      tableName,
      cdcOperation: operation,
      recordId: recordId.toString(),
      component: 'cdc_service',
    });
  }

  public logMessagePublished(topic: string, routingKey: string, messageId: string, context?: LogContext) {
    this.info(`Message published to ${topic}`, {
      ...context,
      operation: 'message_published',
      topic,
      routingKey,
      messageId,
      component: 'message_publisher',
    });
  }

  public logAuthEvent(event: string, userId?: string, success: boolean = true, context?: LogContext) {
    const level = success ? 'info' : 'warn';
    const message = `Auth event: ${event}${success ? ' succeeded' : ' failed'}`;
    
    this.logger.log(level, message, {
      ...context,
      operation: 'auth_event',
      userId,
      authEvent: event,
      success,
      component: 'auth_service',
    });
  }

  // Health check for OpenSearch connection
  public async healthCheck(): Promise<{ opensearch: boolean; winston: boolean }> {
    const result = { opensearch: false, winston: true };

    if (this.opensearchClient) {
      try {
        await this.opensearchClient.ping();
        result.opensearch = true;
      } catch (error) {
        this.error('OpenSearch health check failed', error);
      }
    }

    return result;
  }
}

export const appLogger = AppLogger.getInstance();
export { LogContext };