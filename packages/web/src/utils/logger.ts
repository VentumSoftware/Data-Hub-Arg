interface LogContext {
  userId?: string;
  sessionId?: string;
  page?: string;
  component?: string;
  action?: string;
  correlationId?: string;
  userAgent?: string;
  url?: string;
  [key: string]: any;
}

interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class FrontendLogger {
  private static instance: FrontendLogger;
  private apiEndpoint: string;
  private sessionId: string;
  private logQueue: LogEntry[] = [];
  private isOnline: boolean = navigator.onLine;
  private flushInterval: number = 5000; // 5 seconds
  private maxQueueSize: number = 100;
  private batchSize: number = 10;

  private constructor() {
    this.apiEndpoint = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/logs`;
    this.sessionId = this.generateSessionId();
    
    this.setupEventListeners();
    this.startPeriodicFlush();
  }

  public static getInstance(): FrontendLogger {
    if (!FrontendLogger.instance) {
      FrontendLogger.instance = new FrontendLogger();
    }
    return FrontendLogger.instance;
  }

  private generateSessionId(): string {
    // Use crypto.randomUUID if available, otherwise fallback
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `session-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }

  private setupEventListeners(): void {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushLogs();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Log unhandled errors
    window.addEventListener('error', (event) => {
      this.error('Unhandled JavaScript error', event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        component: 'global_error_handler',
      });
    });

    // Log unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled promise rejection', event.reason, {
        component: 'global_promise_handler',
      });
    });

    // Log page navigation
    this.info('Page loaded', {
      page: window.location.pathname,
      userAgent: navigator.userAgent,
      url: window.location.href,
    });

    // Flush logs before page unload
    window.addEventListener('beforeunload', () => {
      this.flushLogs();
    });
  }

  private startPeriodicFlush(): void {
    setInterval(() => {
      if (this.logQueue.length > 0) {
        this.flushLogs();
      }
    }, this.flushInterval);
  }

  private createLogEntry(level: LogEntry['level'], message: string, error?: Error, context?: LogContext): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: {
        ...context,
        sessionId: this.sessionId,
        userAgent: navigator.userAgent,
        url: window.location.href,
        page: window.location.pathname,
      },
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  private addToQueue(entry: LogEntry): void {
    // Add correlation ID if not present
    if (!entry.context?.correlationId) {
      entry.context = entry.context || {};
      entry.context.correlationId = this.generateSessionId();
    }

    this.logQueue.push(entry);

    // Log to console in development
    if (import.meta.env.DEV) {
      const consoleMethod = entry.level === 'error' ? console.error :
                           entry.level === 'warn' ? console.warn :
                           entry.level === 'debug' ? console.debug :
                           console.log;
      
      consoleMethod(`[${entry.level.toUpperCase()}] ${entry.message}`, entry.context);
      if (entry.error) {
        console.error('Error details:', entry.error);
      }
    }

    // Manage queue size
    if (this.logQueue.length > this.maxQueueSize) {
      this.logQueue = this.logQueue.slice(-this.maxQueueSize);
    }

    // Flush immediately for errors
    if (entry.level === 'error') {
      this.flushLogs();
    }
  }

  private async flushLogs(): Promise<void> {
    if (!this.isOnline || this.logQueue.length === 0) {
      return;
    }

    const logsToSend = this.logQueue.splice(0, this.batchSize);
    
    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-ID': this.generateSessionId(),
        },
        credentials: 'include', // Include cookies for session
        body: JSON.stringify({ logs: logsToSend }),
      });

      if (!response.ok) {
        // Put logs back in queue if send failed
        this.logQueue.unshift(...logsToSend);
        console.warn('Failed to send logs to server:', response.statusText);
      }
    } catch (error) {
      // Put logs back in queue if send failed
      this.logQueue.unshift(...logsToSend);
      console.warn('Error sending logs to server:', error);
    }
  }

  // Public logging methods
  public info(message: string, context?: LogContext): void {
    const entry = this.createLogEntry('info', message, undefined, context);
    this.addToQueue(entry);
  }

  public warn(message: string, context?: LogContext): void {
    const entry = this.createLogEntry('warn', message, undefined, context);
    this.addToQueue(entry);
  }

  public error(message: string, error?: Error, context?: LogContext): void {
    const entry = this.createLogEntry('error', message, error, context);
    this.addToQueue(entry);
  }

  public debug(message: string, context?: LogContext): void {
    const entry = this.createLogEntry('debug', message, undefined, context);
    this.addToQueue(entry);
  }

  // Specialized logging methods
  public logUserAction(action: string, details?: any, context?: LogContext): void {
    this.info(`User action: ${action}`, {
      ...context,
      action,
      details,
      component: context?.component || 'user_interaction',
    });
  }

  public logPageView(page: string, context?: LogContext): void {
    this.info(`Page view: ${page}`, {
      ...context,
      page,
      component: 'navigation',
    });
  }

  public logApiCall(method: string, url: string, duration: number, status: number, context?: LogContext): void {
    const level = status >= 400 ? 'error' : status >= 300 ? 'warn' : 'info';
    const entry = this.createLogEntry(level, `API ${method} ${url}`, undefined, {
      ...context,
      method,
      url,
      duration,
      statusCode: status,
      component: 'api_client',
    });
    this.addToQueue(entry);
  }

  public logPerformance(metric: string, value: number, context?: LogContext): void {
    this.info(`Performance: ${metric}`, {
      ...context,
      metric,
      value,
      component: 'performance',
    });
  }

  // Manual flush for testing
  public flush(): Promise<void> {
    return this.flushLogs();
  }

  // Get current queue size for monitoring
  public getQueueSize(): number {
    return this.logQueue.length;
  }
}

// Export singleton instance
export const frontendLogger = FrontendLogger.getInstance();
export { LogContext };