import { frontendLogger } from './logger';
import { setupApiLogging } from './api-logger';
import { performanceMonitor } from './performance-monitor';

/**
 * Initialize all monitoring and logging systems for the frontend
 */
export const initializeMonitoring = (): void => {
  try {
    // Set up API call logging with fetch interceptor
    setupApiLogging({
      logRequests: import.meta.env.DEV, // Only log requests in development
      logResponses: true,
      logErrors: true,
      excludeUrls: ['/api/logs'], // Don't log the logging endpoint
      includeRequestBody: false, // Privacy - don't log request bodies
      includeResponseBody: false, // Privacy - don't log response bodies
    });

    // Initialize performance monitoring
    performanceMonitor.getStats(); // This triggers initialization

    // Log successful initialization
    frontendLogger.info('Monitoring systems initialized', {
      component: 'monitoring_setup',
      systems: ['frontend_logger', 'api_logger', 'performance_monitor'],
    });

    // Log environment information
    frontendLogger.info('Environment information', {
      component: 'environment',
      isDevelopment: import.meta.env.DEV,
      apiUrl: import.meta.env.VITE_API_URL,
      userAgent: navigator.userAgent,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
    });

  } catch (error) {
    console.error('Failed to initialize monitoring systems:', error);
    frontendLogger.error('Failed to initialize monitoring systems', error, {
      component: 'monitoring_setup',
    });
  }
};

/**
 * Log application startup metrics
 */
export const logApplicationStartup = (): void => {
  const startupTime = performance.now();
  
  frontendLogger.info('Application startup', {
    component: 'application',
    operation: 'startup',
    startupTime: Math.round(startupTime),
    url: window.location.href,
    referrer: document.referrer,
    timestamp: new Date().toISOString(),
  });

  // Log viewport information
  frontendLogger.info('Viewport information', {
    component: 'viewport',
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
    },
  });
};

/**
 * Set up error boundary logging
 */
export const logErrorBoundary = (error: Error, errorInfo: { componentStack: string }): void => {
  frontendLogger.error('React Error Boundary caught error', error, {
    component: 'error_boundary',
    componentStack: errorInfo.componentStack,
    url: window.location.href,
  });
};

/**
 * Log route changes for single-page applications
 */
export const logRouteChange = (from: string, to: string, duration?: number): void => {
  frontendLogger.logPageView(to, {
    component: 'router',
    operation: 'route_change',
    fromRoute: from,
    toRoute: to,
    navigationDuration: duration,
  });
};

/**
 * Clean shutdown - flush any pending logs
 */
export const shutdownMonitoring = async (): Promise<void> => {
  try {
    frontendLogger.info('Application shutdown initiated', {
      component: 'monitoring_setup',
      operation: 'shutdown',
    });

    // Flush any remaining logs
    await frontendLogger.flush();
    
    console.log('Monitoring systems shut down successfully');
  } catch (error) {
    console.error('Error during monitoring shutdown:', error);
  }
};