import { Controller, Get, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { appLogger } from '../../logger/winston.logger';
import { DatabaseService } from '../../database/database.service';
import { sql } from 'drizzle-orm';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: ServiceHealth;
    opensearch: ServiceHealth;
    rabbitmq: ServiceHealth;
    logging: ServiceHealth;
  };
  system: {
    memory: MemoryUsage;
    cpu: number;
    nodeVersion: string;
    platform: string;
  };
  metrics: ApplicationMetrics;
}

interface ServiceHealth {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  lastChecked: string;
  error?: string;
  details?: any;
}

interface MemoryUsage {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
  heapUsedPercentage: number;
}

interface ApplicationMetrics {
  totalRequests: number;
  errorRate: number;
  averageResponseTime: number;
  activeConnections: number;
}

@ApiTags('health')
@Controller('api/health')
export class HealthController {
  private startTime: number = Date.now();
  private requestCount: number = 0;
  private errorCount: number = 0;
  private totalResponseTime: number = 0;

  constructor(private readonly databaseService: DatabaseService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get application health status' })
  @ApiResponse({ 
    status: 200, 
    description: 'Health status returned successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'unhealthy', 'degraded'] },
        timestamp: { type: 'string' },
        uptime: { type: 'number' },
        services: { type: 'object' },
        system: { type: 'object' },
        metrics: { type: 'object' },
      }
    }
  })
  async getHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Check all services in parallel
      const [databaseHealth, opensearchHealth, rabbitmqHealth, loggingHealth] = await Promise.allSettled([
        this.checkDatabaseHealth(),
        this.checkOpenSearchHealth(),
        this.checkRabbitMQHealth(),
        this.checkLoggingHealth(),
      ]);

      const services = {
        database: this.getServiceResult(databaseHealth),
        opensearch: this.getServiceResult(opensearchHealth),
        rabbitmq: this.getServiceResult(rabbitmqHealth),
        logging: this.getServiceResult(loggingHealth),
      };

      // Determine overall status
      const unhealthyServices = Object.values(services).filter(service => service.status === 'unhealthy');
      const overallStatus = unhealthyServices.length === 0 ? 'healthy' : 
                           unhealthyServices.length <= 1 ? 'degraded' : 'unhealthy';

      const result: HealthCheckResult = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime,
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services,
        system: this.getSystemMetrics(),
        metrics: this.getApplicationMetrics(),
      };

      const responseTime = Date.now() - startTime;
      
      // Log health check
      appLogger.info('Health check performed', {
        operation: 'health_check',
        status: overallStatus,
        responseTime,
        unhealthyServices: unhealthyServices.length,
      });

      this.updateMetrics(responseTime, false);
      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      appLogger.error('Health check failed', error, {
        operation: 'health_check',
        responseTime,
      });

      this.updateMetrics(responseTime, true);

      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime,
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services: {
          database: { status: 'unhealthy', lastChecked: new Date().toISOString(), error: 'Health check failed' },
          opensearch: { status: 'unhealthy', lastChecked: new Date().toISOString(), error: 'Health check failed' },
          rabbitmq: { status: 'unhealthy', lastChecked: new Date().toISOString(), error: 'Health check failed' },
          logging: { status: 'unhealthy', lastChecked: new Date().toISOString(), error: 'Health check failed' },
        },
        system: this.getSystemMetrics(),
        metrics: this.getApplicationMetrics(),
      };
    }
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if application is ready to serve requests' })
  @ApiResponse({ status: 200, description: 'Application is ready' })
  @ApiResponse({ status: 503, description: 'Application is not ready' })
  async getReadiness(): Promise<{ status: string; timestamp: string }> {
    try {
      // Check critical services only
      const databaseHealth = await this.checkDatabaseHealth();
      
      if (databaseHealth.status === 'unhealthy') {
        throw new Error('Database not ready');
      }

      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      appLogger.warn('Readiness check failed', {
        operation: 'readiness_check',
        error: error.message,
      });

      return {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if application is alive' })
  @ApiResponse({ status: 200, description: 'Application is alive' })
  async getLiveness(): Promise<{ status: string; timestamp: string; uptime: number }> {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
    };
  }

  private async checkDatabaseHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      // Simple query to check database connectivity
      const result = await this.databaseService.db.execute(sql`SELECT 1 as healthy`);
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        details: { queryResult: result.rowCount > 0 },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: 'unhealthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  private async checkOpenSearchHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const opensearchHealth = await appLogger.healthCheck();
      const responseTime = Date.now() - startTime;

      return {
        status: opensearchHealth.opensearch ? 'healthy' : 'unhealthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        details: opensearchHealth,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: 'unhealthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  private async checkRabbitMQHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      // Simple check - in a real implementation, you'd check RabbitMQ connection
      // For now, we'll just check if the environment variable is set
      const rabbitmqUrl = process.env.RABBITMQ_URL;
      const responseTime = Date.now() - startTime;

      if (!rabbitmqUrl) {
        return {
          status: 'unhealthy',
          responseTime,
          lastChecked: new Date().toISOString(),
          error: 'RabbitMQ URL not configured',
        };
      }

      return {
        status: 'healthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        details: { url: rabbitmqUrl.replace(/\/\/.*@/, '//***:***@') }, // Hide credentials
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: 'unhealthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  private async checkLoggingHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const loggingHealth = await appLogger.healthCheck();
      const responseTime = Date.now() - startTime;

      return {
        status: loggingHealth.winston ? 'healthy' : 'unhealthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        details: loggingHealth,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: 'unhealthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  private getServiceResult(result: PromiseSettledResult<ServiceHealth>): ServiceHealth {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        status: 'unhealthy',
        lastChecked: new Date().toISOString(),
        error: result.reason?.message || 'Unknown error',
      };
    }
  }

  private getSystemMetrics(): {
    memory: MemoryUsage;
    cpu: number;
    nodeVersion: string;
    platform: string;
  } {
    const memUsage = process.memoryUsage();
    return {
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers,
        heapUsedPercentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      },
      cpu: process.cpuUsage().user / 1000000, // Convert to seconds
      nodeVersion: process.version,
      platform: process.platform,
    };
  }

  private getApplicationMetrics(): ApplicationMetrics {
    return {
      totalRequests: this.requestCount,
      errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0,
      averageResponseTime: this.requestCount > 0 ? this.totalResponseTime / this.requestCount : 0,
      activeConnections: 0, // This would need to be tracked separately
    };
  }

  private updateMetrics(responseTime: number, isError: boolean): void {
    this.requestCount++;
    this.totalResponseTime += responseTime;
    if (isError) {
      this.errorCount++;
    }
  }
}