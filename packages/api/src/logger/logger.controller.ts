import { Controller, Post, Body, HttpStatus, HttpCode, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '../access/guards/auth.guard';
import { appLogger } from './winston.logger';
import { Request } from 'express';

interface FrontendLogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  context?: {
    userId?: string;
    sessionId?: string;
    page?: string;
    component?: string;
    action?: string;
    correlationId?: string;
    userAgent?: string;
    url?: string;
    [key: string]: any;
  };
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

interface LogsPayload {
  logs: FrontendLogEntry[];
}

@ApiTags('logging')
@Controller('api/logs')
export class LoggerController {
  
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive frontend logs' })
  @ApiBody({
    description: 'Array of log entries from frontend',
    schema: {
      type: 'object',
      properties: {
        logs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              level: { type: 'string', enum: ['info', 'warn', 'error', 'debug'] },
              message: { type: 'string' },
              timestamp: { type: 'string' },
              context: { type: 'object' },
              error: { type: 'object' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Logs received successfully' })
  @ApiResponse({ status: 400, description: 'Invalid log format' })
  async receiveLogs(@Body() payload: LogsPayload, @Req() req: Request) {
    try {
      const { logs } = payload;
      
      if (!Array.isArray(logs) || logs.length === 0) {
        appLogger.warn('Invalid logs payload received', {
          operation: 'receive_frontend_logs',
          error: 'Payload is not an array or is empty',
          correlationId: req.headers['x-correlation-id'] as string,
        });
        return { status: 'error', message: 'Invalid logs payload' };
      }

      // Process each log entry
      for (const logEntry of logs) {
        await this.processLogEntry(logEntry, req);
      }

      appLogger.info(`Processed ${logs.length} frontend log entries`, {
        operation: 'receive_frontend_logs',
        count: logs.length,
        correlationId: req.headers['x-correlation-id'] as string,
      });

      return { 
        status: 'success', 
        message: `Processed ${logs.length} log entries`,
        processed: logs.length 
      };

    } catch (error) {
      appLogger.error('Error processing frontend logs', error, {
        operation: 'receive_frontend_logs',
        correlationId: req.headers['x-correlation-id'] as string,
      });

      return { 
        status: 'error', 
        message: 'Failed to process logs' 
      };
    }
  }

  @Post('health')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Check logging system health' })
  @ApiResponse({ status: 200, description: 'Health status returned' })
  async checkHealth() {
    try {
      const health = await appLogger.healthCheck();
      
      appLogger.info('Logging health check performed', {
        operation: 'logging_health_check',
        health,
      });

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
          winston: health.winston,
          opensearch: health.opensearch,
        },
      };
    } catch (error) {
      appLogger.error('Health check failed', error, {
        operation: 'logging_health_check',
      });

      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  private async processLogEntry(logEntry: FrontendLogEntry, req: Request): Promise<void> {
    try {
      // Enhance context with server-side information
      const enhancedContext = {
        ...logEntry.context,
        component: `frontend.${logEntry.context?.component || 'unknown'}`,
        operation: 'frontend_log',
        correlationId: logEntry.context?.correlationId || req.headers['x-correlation-id'] as string,
        serverTimestamp: new Date().toISOString(),
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.connection.remoteAddress,
        // Add user info if available from session
        userId: (req as any).user?.id || logEntry.context?.userId,
      };

      // Log using appropriate level
      switch (logEntry.level) {
        case 'error':
          if (logEntry.error) {
            const error = new Error(logEntry.error.message);
            error.name = logEntry.error.name;
            error.stack = logEntry.error.stack;
            appLogger.error(`Frontend: ${logEntry.message}`, error, enhancedContext);
          } else {
            appLogger.error(`Frontend: ${logEntry.message}`, undefined, enhancedContext);
          }
          break;
        
        case 'warn':
          appLogger.warn(`Frontend: ${logEntry.message}`, enhancedContext);
          break;
        
        case 'debug':
          appLogger.debug(`Frontend: ${logEntry.message}`, enhancedContext);
          break;
        
        case 'info':
        default:
          appLogger.info(`Frontend: ${logEntry.message}`, enhancedContext);
          break;
      }

      // Special handling for specific frontend events
      if (logEntry.context?.action) {
        this.handleUserAction(logEntry, enhancedContext);
      }

      if (logEntry.context?.component === 'api_client') {
        this.handleApiCallLog(logEntry, enhancedContext);
      }

      if (logEntry.context?.component === 'performance') {
        this.handlePerformanceLog(logEntry, enhancedContext);
      }

    } catch (error) {
      appLogger.error('Error processing individual log entry', error, {
        operation: 'process_frontend_log',
        originalLogMessage: logEntry.message,
        originalLogLevel: logEntry.level,
      });
    }
  }

  private handleUserAction(logEntry: FrontendLogEntry, context: any): void {
    appLogger.logUserAction(
      logEntry.context?.action || 'unknown_action',
      context.userId || 'anonymous',
      {
        ...context,
        details: logEntry.context,
      }
    );
  }

  private handleApiCallLog(logEntry: FrontendLogEntry, context: any): void {
    const { method, url, duration, statusCode } = logEntry.context || {};
    
    if (method && url) {
      appLogger.info(`Frontend API call: ${method} ${url}`, {
        ...context,
        operation: 'frontend_api_call',
        method,
        url,
        duration,
        statusCode,
      });
    }
  }

  private handlePerformanceLog(logEntry: FrontendLogEntry, context: any): void {
    const { metric, value } = logEntry.context || {};
    
    if (metric && typeof value === 'number') {
      appLogger.info(`Frontend performance: ${metric} = ${value}ms`, {
        ...context,
        operation: 'frontend_performance',
        metric,
        value,
        performanceMetric: true,
      });
    }
  }
}