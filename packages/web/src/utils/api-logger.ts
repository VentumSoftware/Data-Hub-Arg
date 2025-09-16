import { frontendLogger } from './logger';

interface ApiLogConfig {
  logRequests?: boolean;
  logResponses?: boolean;
  logErrors?: boolean;
  excludeUrls?: string[];
  includeRequestBody?: boolean;
  includeResponseBody?: boolean;
}

const defaultConfig: ApiLogConfig = {
  logRequests: true,
  logResponses: true,
  logErrors: true,
  excludeUrls: ['/api/logs'], // Don't log the logging endpoint itself
  includeRequestBody: false, // Privacy - don't log request bodies by default
  includeResponseBody: false, // Privacy - don't log response bodies by default
};

class ApiLogger {
  private config: ApiLogConfig;

  constructor(config: Partial<ApiLogConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Wrap the native fetch function to add automatic API logging
   */
  public setupFetchInterceptor(): void {
    const originalFetch = window.fetch;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method || 'GET';
      const startTime = performance.now();

      // Check if this URL should be excluded from logging
      if (this.shouldExcludeUrl(url)) {
        return originalFetch(input, init);
      }

      // Add correlation ID to headers
      const correlationId = this.generateCorrelationId();
      const headers = new Headers(init?.headers);
      headers.set('X-Correlation-ID', correlationId);

      const modifiedInit = {
        ...init,
        headers,
      };

      // Log request
      if (this.config.logRequests) {
        this.logRequest(method, url, correlationId, modifiedInit);
      }

      try {
        const response = await originalFetch(input, modifiedInit);
        const duration = performance.now() - startTime;

        // Log response
        if (this.config.logResponses) {
          await this.logResponse(method, url, response, duration, correlationId);
        }

        return response;
      } catch (error) {
        const duration = performance.now() - startTime;
        
        // Log error
        if (this.config.logErrors) {
          this.logError(method, url, error as Error, duration, correlationId);
        }

        throw error;
      }
    };
  }

  /**
   * Create axios interceptors for automatic API logging
   */
  public setupAxiosInterceptors(axios: any): void {
    // Request interceptor
    axios.interceptors.request.use(
      (config: any) => {
        const startTime = performance.now();
        config.metadata = { startTime };
        
        // Add correlation ID
        const correlationId = this.generateCorrelationId();
        config.headers['X-Correlation-ID'] = correlationId;
        config.metadata.correlationId = correlationId;

        // Log request
        if (this.config.logRequests && !this.shouldExcludeUrl(config.url)) {
          this.logRequest(config.method?.toUpperCase() || 'GET', config.url, correlationId, config);
        }

        return config;
      },
      (error: any) => {
        frontendLogger.error('Request interceptor error', error, {
          component: 'axios_interceptor',
        });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    axios.interceptors.response.use(
      (response: any) => {
        const duration = performance.now() - response.config.metadata.startTime;
        const { correlationId } = response.config.metadata;

        if (this.config.logResponses && !this.shouldExcludeUrl(response.config.url)) {
          this.logResponse(
            response.config.method?.toUpperCase() || 'GET',
            response.config.url,
            response,
            duration,
            correlationId
          );
        }

        return response;
      },
      (error: any) => {
        const config = error.config || {};
        const duration = config.metadata ? performance.now() - config.metadata.startTime : 0;
        const correlationId = config.metadata?.correlationId;

        if (this.config.logErrors && !this.shouldExcludeUrl(config.url)) {
          this.logError(
            config.method?.toUpperCase() || 'GET',
            config.url,
            error,
            duration,
            correlationId
          );
        }

        return Promise.reject(error);
      }
    );
  }

  private shouldExcludeUrl(url: string): boolean {
    return this.config.excludeUrls?.some(excludeUrl => url.includes(excludeUrl)) || false;
  }

  private generateCorrelationId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `req-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }

  private logRequest(method: string, url: string, correlationId: string, config: any): void {
    const context = {
      component: 'api_client',
      operation: 'request',
      method,
      url,
      correlationId,
    };

    if (this.config.includeRequestBody && config.body) {
      try {
        const body = typeof config.body === 'string' ? JSON.parse(config.body) : config.body;
        (context as any).requestBody = this.sanitizeData(body);
      } catch {
        // Ignore parsing errors for request body
      }
    }

    frontendLogger.debug(`API Request: ${method} ${url}`, context);
  }

  private async logResponse(method: string, url: string, response: any, duration: number, correlationId: string): Promise<void> {
    const status = response.status;
    const context = {
      component: 'api_client',
      operation: 'response',
      method,
      url,
      statusCode: status,
      duration: Math.round(duration),
      correlationId,
    };

    // Include response body if configured and response is small
    if (this.config.includeResponseBody && response.headers.get('content-length')) {
      const contentLength = parseInt(response.headers.get('content-length') || '0');
      if (contentLength < 1000) { // Only log small responses
        try {
          const responseClone = response.clone();
          const responseBody = await responseClone.json();
          (context as any).responseBody = this.sanitizeData(responseBody);
        } catch {
          // Ignore parsing errors for response body
        }
      }
    }

    // Log using the frontend logger's API call method
    frontendLogger.logApiCall(method, url, Math.round(duration), status, {
      correlationId,
      ...context,
    });
  }

  private logError(method: string, url: string, error: Error, duration: number, correlationId?: string): void {
    const context = {
      component: 'api_client',
      operation: 'error',
      method,
      url,
      duration: Math.round(duration),
      correlationId,
    };

    frontendLogger.error(`API Error: ${method} ${url}`, error, context);
  }

  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization', 'cookie'];
    const sanitized = { ...data };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  public updateConfig(config: Partial<ApiLogConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Export singleton instance
export const apiLogger = new ApiLogger();

// Helper function to set up logging for the most common use case
export const setupApiLogging = (config?: Partial<ApiLogConfig>): void => {
  if (config) {
    apiLogger.updateConfig(config);
  }
  
  // Set up fetch interceptor by default
  apiLogger.setupFetchInterceptor();
};