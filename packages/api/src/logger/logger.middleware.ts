import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { appLogger } from './winston.logger';
import { randomUUID } from 'crypto';
import { MetricsService } from '../common/metrics/metrics.service';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request & { startTime?: number }, res: Response, next: NextFunction) {
    // Add correlation ID if not present
    if (!req.headers['x-correlation-id']) {
      req.headers['x-correlation-id'] = randomUUID();
    }

    // Record start time
    req.startTime = Date.now();

    // Log incoming request for debugging (only in development)
    if (process.env.NODE_ENV === 'development' && process.env.LOG_REQUESTS === 'true') {
      this.logRequestDetails(req);
    }

    // Intercept response to log completion
    const originalSend = res.send;
    res.send = function(data) {
      res.locals.responseBody = data;
      return originalSend.call(this, data);
    };

    res.on('finish', () => {
      const duration = Date.now() - (req.startTime || Date.now());
      
      // Log the request completion
      appLogger.logRequest(req, res, duration);

      // Record metrics
      const route = this.normalizeRoute(req.originalUrl);
      this.metricsService.recordHttpRequest(req.method, route, res.statusCode, duration);

      // Log slow requests as warnings
      if (duration > 2000) {
        appLogger.warn(`Slow request detected: ${req.method} ${req.originalUrl}`, {
          duration,
          statusCode: res.statusCode,
          correlationId: req.headers['x-correlation-id'] as string,
        });
      }

      // Log errors with response body
      if (res.statusCode >= 400 && res.locals.responseBody) {
        try {
          const errorData = typeof res.locals.responseBody === 'string' ?
            JSON.parse(res.locals.responseBody) : res.locals.responseBody;
          
          appLogger.error(`Request failed with ${res.statusCode}`, undefined, {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            duration,
            correlationId: req.headers['x-correlation-id'] as string,
            errorResponse: errorData,
            userId: (req as any).user?.id,
          });
        } catch (parseError) {
          appLogger.error(`Request failed with ${res.statusCode} - unparseable response`, undefined, {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            duration,
            correlationId: req.headers['x-correlation-id'] as string,
          });
        }
      }
    });

    next();
  }

  private logRequestDetails(req: Request) {
    const { method, originalUrl, headers, body, query } = req;
    
    // Sanitize sensitive data
    const sanitizedHeaders = { ...headers };
    if (sanitizedHeaders.authorization) sanitizedHeaders.authorization = '[REDACTED]';
    if (sanitizedHeaders.cookie) sanitizedHeaders.cookie = '[PRESENT]';

    const sanitizedBody = body ? { ...body } : {};
    ['password', 'token', 'secret', 'authorization'].forEach(field => {
      if (sanitizedBody[field]) {
        sanitizedBody[field] = '[REDACTED]';
      }
    });

    appLogger.debug(`Incoming request: ${method} ${originalUrl}`, {
      method,
      url: originalUrl,
      query,
      headers: {
        'content-type': sanitizedHeaders['content-type'],
        'user-agent': sanitizedHeaders['user-agent'],
        'origin': sanitizedHeaders['origin'],
        'authorization': sanitizedHeaders['authorization'],
        'cookie': sanitizedHeaders['cookie'],
      },
      body: Object.keys(sanitizedBody).length > 0 ? sanitizedBody : undefined,
      correlationId: headers['x-correlation-id'] as string,
    });
  }

  private normalizeRoute(url: string): string {
    // Remove query parameters
    const baseUrl = url.split('?')[0];
    
    // Replace path parameters with generic placeholders
    // This helps group similar routes for metrics
    return baseUrl
      .replace(/\/\d+/g, '/:id')           // Replace numeric IDs (PostgreSQL primary keys)
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid'); // Replace UUIDs
  }
}
